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
import { UserNotificationsService } from '../notifications/user-notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { TrackingService } from '../tracking/tracking.service';
import { DriverOffersLiveService } from '../tracking/driver-offers-live.service';
import {
  DRIVER_ACTIVE_STATUSES,
  DRIVER_OFFER_STATUSES,
  MAX_DRIVER_BATCH_ORDERS,
  isCustomerTrackableStatus,
  isDriverOfferStatus,
  isTerminalOrderStatus,
  normalizeOrderStatus,
} from './order-status.constants';
import { PlatformSettingsService } from '../platform-settings/platform-settings.service';
import { EarningsSettlementsService } from './earnings-settlements.service';
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
  merchant: { select: { id: true, name: true, nameAr: true, latitude: true, longitude: true } },
  user: { select: { fullName: true } },
  address: { select: { addressLine: true, latitude: true, longitude: true } },
} satisfies Prisma.OrderSelect;

const driverOrderInclude = {
  orderItems: { orderBy: { id: Prisma.SortOrder.asc }, take: 20 },
  merchant: { select: { id: true, name: true, nameAr: true, latitude: true, longitude: true } },
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
    private readonly userNotifications: UserNotificationsService,
    private readonly tracking: TrackingService,
    private readonly driverOffersLive: DriverOffersLiveService,
    private readonly platformSettings: PlatformSettingsService,
    private readonly settlements: EarningsSettlementsService,
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

  /** Pre-sync Firestore chat meta so opening chat does not wait on first write. */
  private async syncChatMetaIfContactable(order: {
    id: string;
    userId: string;
    driverId: string | null;
    status: string | null;
  }): Promise<void> {
    if (!order.driverId || !isCustomerTrackableStatus(order.status)) {
      return;
    }
    try {
      await this.tracking.syncOrderMeta(
        order.id,
        order.userId,
        order.driverId,
      );
    } catch (err) {
      this.log.warn(
        `syncOrderMeta failed for order ${order.id}: ${String(err)}`,
      );
    }
  }

  /** Unassigned orders ready for pickup from any merchant (indexed filter, lean select). */
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

    await this.syncChatMetaIfContactable(order);

    const sharePercent = await this.driverSharePercent();

    return {
      order: mapDriverOrderDetail(
        order as OrderWithRelations,
        sharePercent,
      ),
    };
  }

  /** All in-progress deliveries for this driver (any merchant). */
  async listActiveAssignments(driverId: string) {
    await this.assertDriverActive(driverId);

    const orders = await this.prisma.order.findMany({
      where: {
        driverId,
        status: { in: [...DRIVER_ACTIVE_STATUSES] },
      },
      include: driverOrderInclude,
      orderBy: { createdAt: 'asc' },
    });

    await Promise.all(orders.map((o) => this.syncChatMetaIfContactable(o)));

    const sharePercent = await this.driverSharePercent();

    return {
      orders: orders.map((o) =>
        mapDriverOrderDetail(o as OrderWithRelations, sharePercent),
      ),
    };
  }

  private roundMoney(value: number): number {
    return Math.round(value * 100) / 100;
  }

  private earningsPeriodBounds(period: 'day' | 'week' | 'month' | 'all'): {
    from: Date;
    to: Date;
    period: 'day' | 'week' | 'month' | 'all';
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
    } else if (period === 'all') {
      from = new Date(now);
      from.setDate(from.getDate() - 89);
      from.setHours(0, 0, 0, 0);
    } else {
      from = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    return { from, to, period };
  }

  private resolveDriverEarningsPeriod(periodRaw: string): {
    from: Date;
    to: Date;
    period: 'day' | 'week' | 'month' | 'all';
  } {
    const period: 'day' | 'week' | 'month' | 'all' =
      periodRaw === 'day' || periodRaw === 'month' || periodRaw === 'all'
        ? periodRaw
        : 'week';
    return this.earningsPeriodBounds(period);
  }

  private async buildDriverEarnings(
    driverId: string,
    periodRaw: string,
    options: { requireActive: boolean; forAdmin?: boolean },
  ) {
    if (options.requireActive) {
      await this.assertDriverActive(driverId);
    }

    const { from, to, period } = this.resolveDriverEarningsPeriod(periodRaw);
    const [sharePercent, paidOrderIds] = await Promise.all([
      this.driverSharePercent(),
      this.settlements.getPaidOrderIds('DRIVER', driverId),
    ]);

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
      take: period === 'all' ? 1000 : 500,
    });

    let totalEarnings = 0;
    let totalPaidEarnings = 0;
    let totalFoodValue = 0;
    let totalDeliveryFees = 0;
    let totalPlatformFee = 0;
    let unpaidTripCount = 0;

    const trips = rows.flatMap((row) => {
      const mapped = mapDriverOrderOffer({
        ...row,
        driverSharePercent: sharePercent,
      });
      const fullDeliveryFee = mapped.deliveryFee ?? 0;
      const driverEarnings = mapped.driverEarnings ?? mapped.fee ?? 0;
      const platformFee = Math.max(0, fullDeliveryFee - driverEarnings);
      const orderValue = mapped.subtotal ?? 0;
      const isPaid = paidOrderIds.has(row.id);
      const payoutStatus = isPaid ? 'PAID' : 'UNPAID';

      if (options.forAdmin) {
        if (isPaid) {
          totalPaidEarnings += driverEarnings;
        } else {
          totalEarnings += driverEarnings;
          unpaidTripCount += 1;
        }
        totalFoodValue += orderValue;
        totalDeliveryFees += fullDeliveryFee;
        totalPlatformFee += platformFee;
      } else if (!isPaid) {
        totalEarnings += driverEarnings;
        totalFoodValue += orderValue;
        totalDeliveryFees += fullDeliveryFee;
        totalPlatformFee += platformFee;
        unpaidTripCount += 1;
      } else {
        return [];
      }

      return [
        {
          id: mapped.id,
          displayId: this.formatOrderDisplayId(row.id, row.checkoutRef),
          merchantName: mapped.merchantName,
          completedAt: mapped.createdAt.toISOString(),
          orderValue: this.roundMoney(orderValue),
          deliveryFee: this.roundMoney(fullDeliveryFee),
          earnings: this.roundMoney(driverEarnings),
          platformFee: this.roundMoney(platformFee),
          payoutStatus,
        },
      ];
    });

    const result: Record<string, unknown> = {
      period,
      periodFrom: from.toISOString(),
      periodTo: to.toISOString(),
      driverSharePercent: sharePercent,
      totalEarnings: this.roundMoney(totalEarnings),
      totalFoodValue: this.roundMoney(totalFoodValue),
      totalDeliveryFees: this.roundMoney(totalDeliveryFees),
      totalPlatformFee: this.roundMoney(totalPlatformFee),
      tripCount: unpaidTripCount,
      trips,
    };

    if (options.forAdmin) {
      result.totalPaidEarnings = this.roundMoney(totalPaidEarnings);
      result.paidTripCount = rows.length - unpaidTripCount;
    }

    return result;
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
    return this.buildDriverEarnings(driverId, periodRaw, {
      requireActive: true,
    });
  }

  /** Super admin: driver earnings with platform fee breakdown. */
  async getEarningsForAdmin(driverId: string, periodRaw: string) {
    const driver = await this.prisma.driver.findUnique({
      where: { id: driverId },
      select: { id: true, fullName: true, isActive: true, phone: true },
    });
    if (!driver) {
      throw new NotFoundException('Driver not found');
    }

    const earnings = await this.buildDriverEarnings(driverId, periodRaw, {
      requireActive: false,
      forAdmin: true,
    });

    const { from, to } = this.resolveDriverEarningsPeriod(periodRaw);
    const settlements = await this.settlements.listSettlements(
      'DRIVER',
      driverId,
      from,
      to,
    );

    return {
      ...earnings,
      driver: {
        id: driver.id,
        fullName: driver.fullName,
        phone: driver.phone,
        isActive: driver.isActive,
      },
      settlements,
    };
  }

  async markDriverEarningsPaid(driverId: string, periodRaw: string) {
    const { from, to } = this.resolveDriverEarningsPeriod(periodRaw);
    const sharePercent = await this.driverSharePercent();
    const settlement = await this.settlements.markDriverEarningsPaid(
      driverId,
      from,
      to,
      sharePercent,
    );

    return {
      id: settlement.id,
      referenceCode: settlement.referenceCode,
      periodFrom: settlement.periodFrom.toISOString(),
      periodTo: settlement.periodTo.toISOString(),
      grossAmount: Number(settlement.grossAmount),
      netAmount: Number(settlement.netAmount),
      platformFee: Number(settlement.platformFee),
      orderCount: settlement.orderCount,
      status: settlement.status,
      paidAt: settlement.paidAt.toISOString(),
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
    await this.syncChatMetaIfContactable(order);
    const sharePercent = await this.driverSharePercent();
    return mapDriverOrderDetail(order as OrderWithRelations, sharePercent);
  }

  /**
   * Atomically claim an unassigned offer. One DB round-trip via updateMany guard.
   */
  async acceptOrder(driverId: string, orderId: string) {
    await this.assertDriverActive(driverId);

    // Orders the driver is already delivering (excluding this one).
    // Drivers may accept from any merchant while already on other deliveries.
    const activeOrders = await this.prisma.order.findMany({
      where: {
        driverId,
        status: { in: [...DRIVER_ACTIVE_STATUSES] },
      },
      select: { id: true },
    });
    const otherActiveCount = activeOrders.filter((o) => o.id !== orderId).length;

    if (otherActiveCount + 1 > MAX_DRIVER_BATCH_ORDERS) {
      throw new BadRequestException(
        `You can carry at most ${MAX_DRIVER_BATCH_ORDERS} orders at once`,
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
    void this.driverOffersLive.removeOffer(orderId).catch(() => undefined);

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
    await this.notifyCustomerOrderInboxAndPush(order, {
      status: 'DELIVERING',
      title: 'Delivery accepted',
      body: `A driver accepted your order from ${this.merchantNameFromOrder(order)}. Tap to track your delivery.`,
    });
  }

  private merchantNameFromOrder(order: OrderWithRelations): string {
    const snapshot = this.parseSnapshot(order.itemsSnapshot);
    return snapshot?.merchantName ?? order.merchant.name;
  }

  private merchantNameArFromOrder(order: OrderWithRelations): string | null {
    return order.merchant.nameAr ?? null;
  }

  private async notifyCustomerOrderInboxAndPush(
    order: OrderWithRelations,
    params: {
      status: string;
      title?: string;
      body?: string;
    },
  ) {
    const merchantName = this.merchantNameFromOrder(order);
    const merchantNameAr = this.merchantNameArFromOrder(order);
    const copy = await this.userNotifications.createFromOrderStatus({
      userId: order.userId,
      orderId: order.id,
      status: params.status,
      merchantName,
      merchantNameAr,
      title: params.title,
      body: params.body,
    });

    const user = await this.prisma.user.findUnique({
      where: { id: order.userId },
      select: { fcmToken: true },
    });
    if (!user?.fcmToken?.trim()) {
      return;
    }

    const result: SendOrderStatusResult =
      await this.notifications.sendOrderStatusUpdate({
        fcmToken: user.fcmToken.trim(),
        orderId: order.id,
        status: params.status,
        merchantName,
        title: copy.title,
        body: copy.body,
      });

    if (!result.sent) {
      this.log.debug(
        `Order ${order.id} status push not sent: ${result.reason ?? 'unknown'}`,
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
    await this.syncChatMetaIfContactable(row);

    const sharePercent = await this.driverSharePercent();

    return {
      pickedUp: true as const,
      order: mapDriverOrderDetail(row, sharePercent),
    };
  }

  private async notifyCustomerDispatched(order: OrderWithRelations) {
    const merchantName = this.merchantNameFromOrder(order);
    await this.notifyCustomerOrderInboxAndPush(order, {
      status: 'DISPATCHED',
      title: 'Order picked up',
      body: `Your driver picked up your order from ${merchantName} and is heading to you.`,
    });
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
    await this.notifyCustomerOrderInboxAndPush(order, {
      status: 'DELIVERED',
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

  private async notifyDriverAdminAssignment(
    orderId: string,
    driverId: string,
  ) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        merchantId: true,
        deliveryFee: true,
        itemsSnapshot: true,
        merchant: { select: { name: true } },
      },
    });
    if (!order) {
      return;
    }

    const driver = await this.prisma.driver.findUnique({
      where: { id: driverId },
      select: { fcmToken: true },
    });
    const token = driver?.fcmToken?.trim();
    if (!token) {
      return;
    }

    const snapshot = this.parseSnapshot(order.itemsSnapshot);
    const merchantName = snapshot?.merchantName ?? order.merchant.name;
    const deliveryFee =
      order.deliveryFee != null ? Number(order.deliveryFee) : undefined;

    try {
      await this.driverOffersLive.publishOffer({
        orderId: order.id,
        merchantId: order.merchantId,
        merchantName,
        status: 'ACCEPTED',
        ...(deliveryFee != null && Number.isFinite(deliveryFee)
          ? { deliveryFee }
          : {}),
      });
    } catch (err) {
      this.log.warn(
        `Driver assignment RTDB publish failed for ${orderId}: ${err instanceof Error ? err.message : err}`,
      );
    }

    const result = await this.notifications.sendDriverOfferAlert({
      tokens: [token],
      orderId: order.id,
      merchantId: order.merchantId,
      merchantName,
      deliveryFee,
    });

    if (!result.sent) {
      this.log.debug(
        `Driver assignment push for ${orderId} not sent: ${result.reason ?? 'unknown'}`,
      );
    }
  }

  /**
   * Super admin manually assigns a driver to an unassigned PENDING or ACCEPTED order.
   * ACCEPTED orders follow the same delivery-start flow as driver self-accept.
   */
  async assignOrderByAdmin(orderId: string, driverId: string) {
    await this.assertDriverActive(driverId);

    const existing = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, status: true, driverId: true },
    });
    if (!existing) {
      throw new NotFoundException('Order not found');
    }
    if (existing.driverId) {
      throw new ConflictException('Order already assigned to a driver');
    }

    const status = normalizeOrderStatus(existing.status);
    if (status === 'ACCEPTED') {
      // acceptOrder enforces MAX_DRIVER_BATCH_ORDERS across merchants
      const result = await this.acceptOrder(driverId, orderId);
      await this.notifyDriverAdminAssignment(orderId, driverId);
      return result;
    }
    if (status === 'PENDING') {
      const busy = await this.prisma.order.count({
        where: {
          driverId,
          status: { in: [...DRIVER_ACTIVE_STATUSES] },
        },
      });
      if (busy >= MAX_DRIVER_BATCH_ORDERS) {
        throw new BadRequestException(
          `Driver already has ${MAX_DRIVER_BATCH_ORDERS} active deliveries`,
        );
      }
      const updated = await this.prisma.order.updateMany({
        where: {
          id: orderId,
          driverId: null,
          status: 'PENDING',
        },
        data: { driverId },
      });
      if (updated.count === 0) {
        throw new ConflictException('Order is no longer available for assignment');
      }
      await this.notifyDriverAdminAssignment(orderId, driverId);
      return {
        assigned: true as const,
        preAssigned: true as const,
        orderId,
        driverId,
      };
    }

    throw new BadRequestException(
      `Order cannot be assigned in status ${status}`,
    );
  }
}
