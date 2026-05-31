import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  OrderNotificationsPort,
  type SendOrderStatusResult,
} from '../notifications/notifications.port';
import { PrismaService } from '../prisma/prisma.service';
import { TrackingService } from '../tracking/tracking.service';
import {
  DRIVER_ACTIVE_STATUSES,
  DRIVER_OFFER_STATUSES,
  isDriverOfferStatus,
  isTerminalOrderStatus,
  normalizeOrderStatus,
} from './order-status.constants';
import { PlatformSettingsService } from '../platform-settings/platform-settings.service';
import { mapDriverOrderDetail, mapDriverOrderOffer } from './order-driver.mapper';
import { OrderItemsSnapshot, OrderWithRelations } from './order.types';

const driverOfferSelect = {
  id: true,
  status: true,
  subtotal: true,
  total: true,
  deliveryFee: true,
  itemsSnapshot: true,
  createdAt: true,
  merchant: { select: { name: true, latitude: true, longitude: true } },
  user: { select: { fullName: true } },
  address: { select: { addressLine: true, latitude: true, longitude: true } },
} satisfies Prisma.OrderSelect;

const driverOrderInclude = {
  orderItems: { orderBy: { id: Prisma.SortOrder.asc }, take: 20 },
  merchant: { select: { id: true, name: true, latitude: true, longitude: true } },
  user: { select: { id: true, fullName: true, phone: true } },
  address: {
    select: {
      id: true,
      addressLine: true,
      latitude: true,
      longitude: true,
    },
  },
} satisfies Prisma.OrderInclude;

@Injectable()
export class DriverOrdersService {
  private readonly log = new Logger(DriverOrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: OrderNotificationsPort,
    private readonly tracking: TrackingService,
    private readonly platformSettings: PlatformSettingsService,
  ) {}

  private async driverSharePercent(): Promise<number> {
    return this.platformSettings.getDriverDeliverySharePercent();
  }

  private normalizePagination(page: number, limit: number) {
    const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
    const safeLimit =
      Number.isFinite(limit) && limit > 0
        ? Math.min(Math.floor(limit), 50)
        : 20;
    return {
      page: safePage,
      limit: safeLimit,
      skip: (safePage - 1) * safeLimit,
    };
  }

  private pagedResponse<T>(
    items: T[],
    total: number,
    page: number,
    limit: number,
  ) {
    return {
      items,
      pagination: {
        page,
        limit,
        pageTotal: items.length,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  private async assertDriverActive(driverId: string) {
    const driver = await this.prisma.driver.findUnique({
      where: { id: driverId },
      select: { isActive: true },
    });
    if (!driver) {
      throw new NotFoundException('Driver not found');
    }
    if (!driver.isActive) {
      throw new ForbiddenException('Driver account is not active');
    }
  }

  /** Unassigned orders ready for pickup (indexed filter, lean select). */
  async listAvailable(driverId: string, page = 1, limit = 20) {
    await this.assertDriverActive(driverId);

    const { page: p, limit: l, skip } = this.normalizePagination(page, limit);
    const offerMaxAgeMs = 72 * 60 * 60 * 1000;
    const where: Prisma.OrderWhereInput = {
      driverId: null,
      status: { in: [...DRIVER_OFFER_STATUSES] },
      createdAt: { gte: new Date(Date.now() - offerMaxAgeMs) },
    };

    const [rows, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        select: driverOfferSelect,
        orderBy: { createdAt: 'desc' },
        skip,
        take: l,
      }),
      this.prisma.order.count({ where }),
    ]);

    const sharePercent = await this.driverSharePercent();

    return this.pagedResponse(
      rows.map((o) =>
        mapDriverOrderOffer({ ...o, driverSharePercent: sharePercent }),
      ),
      total,
      p,
      l,
    );
  }

  /** Current in-progress delivery for this driver (at most one). */
  async getActiveAssignment(driverId: string) {
    await this.assertDriverActive(driverId);

    const order = await this.prisma.order.findFirst({
      where: {
        driverId,
        status: { in: [...DRIVER_ACTIVE_STATUSES] },
      },
      include: driverOrderInclude,
      orderBy: { createdAt: 'desc' },
    });

    if (!order) {
      return { order: null };
    }

    const sharePercent = await this.driverSharePercent();

    return {
      order: mapDriverOrderDetail(
        order as OrderWithRelations,
        sharePercent,
      ),
    };
  }

  private roundMoney(value: number): number {
    return Math.round(value * 100) / 100;
  }

  private earningsPeriodBounds(period: 'day' | 'week' | 'month'): {
    from: Date;
    to: Date;
  } {
    const now = new Date();
    const to = now;
    let from: Date;

    if (period === 'day') {
      from = new Date(now);
      from.setHours(0, 0, 0, 0);
    } else if (period === 'week') {
      from = new Date(now);
      from.setDate(from.getDate() - 6);
      from.setHours(0, 0, 0, 0);
    } else {
      from = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    return { from, to };
  }

  private formatOrderDisplayId(orderId: string, checkoutRef?: string | null): string {
    const ref = checkoutRef?.trim();
    if (ref) {
      return ref.length > 8 ? ref.slice(-8).toUpperCase() : ref.toUpperCase();
    }
    return orderId.slice(0, 8).toUpperCase();
  }

  /** Completed deliveries and delivery-fee earnings for the selected period. */
  async getEarnings(driverId: string, periodRaw: string) {
    await this.assertDriverActive(driverId);

    const period: 'day' | 'week' | 'month' =
      periodRaw === 'day' || periodRaw === 'month' ? periodRaw : 'week';
    const { from, to } = this.earningsPeriodBounds(period);
    const sharePercent = await this.driverSharePercent();

    const rows = await this.prisma.order.findMany({
      where: {
        driverId,
        status: 'DELIVERED',
        createdAt: { gte: from, lte: to },
      },
      select: {
        ...driverOfferSelect,
        checkoutRef: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });

    let totalEarnings = 0;
    let totalFoodValue = 0;

    const trips = rows.map((row) => {
      const mapped = mapDriverOrderOffer({
        ...row,
        driverSharePercent: sharePercent,
      });
      const fullDeliveryFee = mapped.deliveryFee ?? 0;
      const driverEarnings = mapped.driverEarnings ?? mapped.fee ?? 0;
      const orderValue = mapped.subtotal ?? 0;
      totalEarnings += driverEarnings;
      totalFoodValue += orderValue;

      return {
        id: mapped.id,
        displayId: this.formatOrderDisplayId(row.id, row.checkoutRef),
        merchantName: mapped.merchantName,
        completedAt: mapped.createdAt.toISOString(),
        orderValue: this.roundMoney(orderValue),
        deliveryFee: this.roundMoney(fullDeliveryFee),
        earnings: this.roundMoney(driverEarnings),
        platformFee: this.roundMoney(
          Math.max(0, fullDeliveryFee - driverEarnings),
        ),
      };
    });

    return {
      period,
      driverSharePercent: sharePercent,
      totalEarnings: this.roundMoney(totalEarnings),
      totalFoodValue: this.roundMoney(totalFoodValue),
      tripCount: trips.length,
      trips,
    };
  }

  async listMine(driverId: string, page = 1, limit = 20) {
    await this.assertDriverActive(driverId);

    const { page: p, limit: l, skip } = this.normalizePagination(page, limit);
    const where = { driverId };

    const [rows, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        select: driverOfferSelect,
        orderBy: { createdAt: 'desc' },
        skip,
        take: l,
      }),
      this.prisma.order.count({ where }),
    ]);

    const sharePercent = await this.driverSharePercent();

    return this.pagedResponse(
      rows.map((o) =>
        mapDriverOrderOffer({ ...o, driverSharePercent: sharePercent }),
      ),
      total,
      p,
      l,
    );
  }

  async getOne(driverId: string, orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, driverId },
      include: driverOrderInclude,
    });
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    const sharePercent = await this.driverSharePercent();
    return mapDriverOrderDetail(order as OrderWithRelations, sharePercent);
  }

  /**
   * Atomically claim an unassigned offer. One DB round-trip via updateMany guard.
   */
  async acceptOrder(driverId: string, orderId: string) {
    await this.assertDriverActive(driverId);

    const active = await this.prisma.order.findFirst({
      where: {
        driverId,
        status: { in: [...DRIVER_ACTIVE_STATUSES] },
      },
      select: { id: true },
    });
    if (active && active.id !== orderId) {
      throw new BadRequestException(
        'Finish your current delivery before accepting another order',
      );
    }

    const updated = await this.prisma.order.updateMany({
      where: {
        id: orderId,
        driverId: null,
        status: { in: [...DRIVER_OFFER_STATUSES] },
      },
      data: { driverId, status: 'DELIVERING' },
    });

    if (updated.count === 0) {
      const existing = await this.prisma.order.findUnique({
        where: { id: orderId },
        select: { driverId: true, status: true },
      });
      if (!existing) {
        throw new NotFoundException('Order not found');
      }
      if (existing.driverId === driverId) {
        const order = await this.prisma.order.findFirst({
          where: { id: orderId, driverId },
          include: driverOrderInclude,
        });
        const sharePercent = await this.driverSharePercent();
        return {
          accepted: true as const,
          order: mapDriverOrderDetail(
            order! as OrderWithRelations,
            sharePercent,
          ),
        };
      }
      if (existing.driverId) {
        throw new ConflictException('Order already assigned to another driver');
      }
      const status = normalizeOrderStatus(existing.status);
      if (!isDriverOfferStatus(status)) {
        throw new BadRequestException(
          `Order cannot be accepted in status ${status}`,
        );
      }
      throw new ConflictException('Order is no longer available');
    }

    const order = await this.prisma.order.findFirst({
      where: { id: orderId, driverId },
      include: driverOrderInclude,
    });

    const row = order! as OrderWithRelations;
    await this.notifyCustomerDelivering(row);
    await this.tracking.syncOrderMeta(orderId, row.userId, driverId);

    const sharePercent = await this.driverSharePercent();

    return {
      accepted: true as const,
      order: mapDriverOrderDetail(row, sharePercent),
    };
  }

  private parseSnapshot(raw: unknown): OrderItemsSnapshot | null {
    if (!raw || typeof raw !== 'object') {
      return null;
    }
    const s = raw as OrderItemsSnapshot;
    if (!Array.isArray(s.items)) {
      return null;
    }
    return s;
  }

  private async notifyCustomerDelivering(order: OrderWithRelations) {
    const user = await this.prisma.user.findUnique({
      where: { id: order.userId },
      select: { fcmToken: true },
    });
    if (!user?.fcmToken?.trim()) {
      return;
    }

    const snapshot = this.parseSnapshot(order.itemsSnapshot);
    const merchantName = snapshot?.merchantName ?? order.merchant.name;

    const result: SendOrderStatusResult =
      await this.notifications.sendOrderStatusUpdate({
        fcmToken: user.fcmToken.trim(),
        orderId: order.id,
        status: 'DELIVERING',
        merchantName,
        title: 'Delivery accepted',
        body: `A driver accepted your order from ${merchantName}. Tap to track your delivery.`,
      });

    if (!result.sent) {
      this.log.debug(
        `Order ${order.id} driver-accept push not sent: ${result.reason ?? 'unknown'}`,
      );
    }
  }

  /** Driver picked up order at merchant → DISPATCHED (customer notified). */
  async confirmPickup(driverId: string, orderId: string) {
    await this.assertDriverActive(driverId);
    await this.assertDriverOwnsOrder(driverId, orderId);

    const updated = await this.prisma.order.updateMany({
      where: {
        id: orderId,
        driverId,
        status: 'DELIVERING',
      },
      data: { status: 'DISPATCHED' },
    });

    if (updated.count === 0) {
      throw new BadRequestException(
        'Order must be DELIVERING before confirming pickup',
      );
    }

    const order = await this.prisma.order.findFirst({
      where: { id: orderId, driverId },
      include: driverOrderInclude,
    });

    const row = order! as OrderWithRelations;
    await this.notifyCustomerDispatched(row);

    const sharePercent = await this.driverSharePercent();

    return {
      pickedUp: true as const,
      order: mapDriverOrderDetail(row, sharePercent),
    };
  }

  private async notifyCustomerDispatched(order: OrderWithRelations) {
    const user = await this.prisma.user.findUnique({
      where: { id: order.userId },
      select: { fcmToken: true },
    });
    if (!user?.fcmToken?.trim()) {
      return;
    }

    const snapshot = this.parseSnapshot(order.itemsSnapshot);
    const merchantName = snapshot?.merchantName ?? order.merchant.name;

    const result = await this.notifications.sendOrderStatusUpdate({
      fcmToken: user.fcmToken.trim(),
      orderId: order.id,
      status: 'DISPATCHED',
      merchantName,
      title: 'Order picked up',
      body: `Your driver picked up your order from ${merchantName} and is heading to you.`,
    });

    if (!result.sent) {
      this.log.debug(
        `Order ${order.id} pickup push not sent: ${result.reason ?? 'unknown'}`,
      );
    }
  }

  /** Mark assigned order as delivered and notify the customer. */
  async completeOrder(driverId: string, orderId: string) {
    await this.assertDriverActive(driverId);
    await this.assertDriverOwnsOrder(driverId, orderId);

    const updated = await this.prisma.order.updateMany({
      where: {
        id: orderId,
        driverId,
        status: 'DISPATCHED',
      },
      data: { status: 'DELIVERED' },
    });

    if (updated.count === 0) {
      throw new BadRequestException(
        'Confirm pickup at the merchant before finishing delivery',
      );
    }

    const order = await this.prisma.order.findFirst({
      where: { id: orderId, driverId },
      include: driverOrderInclude,
    });

    const row = order! as OrderWithRelations;
    await this.notifyCustomerDelivered(row);

    const sharePercent = await this.driverSharePercent();

    return {
      completed: true as const,
      order: mapDriverOrderDetail(row, sharePercent),
    };
  }

  private async notifyCustomerDelivered(order: OrderWithRelations) {
    const user = await this.prisma.user.findUnique({
      where: { id: order.userId },
      select: { fcmToken: true },
    });
    if (!user?.fcmToken?.trim()) {
      return;
    }

    const snapshot = this.parseSnapshot(order.itemsSnapshot);
    const merchantName = snapshot?.merchantName ?? order.merchant.name;

    await this.notifications.sendOrderStatusUpdate({
      fcmToken: user.fcmToken.trim(),
      orderId: order.id,
      status: 'DELIVERED',
      merchantName,
    });
  }

  async assertDriverOwnsOrder(driverId: string, orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { driverId: true, status: true, userId: true },
    });
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    if (order.driverId !== driverId) {
      throw new ForbiddenException('Not your delivery');
    }
    if (isTerminalOrderStatus(order.status ?? 'PENDING')) {
      throw new BadRequestException('Order is already completed');
    }
    return order;
  }
}
