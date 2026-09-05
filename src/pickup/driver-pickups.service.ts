import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { MAX_DRIVER_BATCH_ORDERS } from '../orders/order-status.constants';
import { OrderNotificationsPort } from '../notifications/notifications.port';
import { PlatformSettingsService } from '../platform-settings/platform-settings.service';
import { PrismaService } from '../prisma/prisma.service';
import { TrackingService } from '../tracking/tracking.service';
import {
  DRIVER_PICKUP_ACTIVE_STATUSES,
  DRIVER_PICKUP_OFFER_STATUSES,
  isTerminalPickupStatus,
  normalizePickupStatus,
} from './pickup.constants';
import { DRIVER_SPECIAL_REQUEST_ACTIVE_STATUSES } from '../special-request/special-request.constants';
import { mapPickupOrder, withDriverEarnings } from './pickup.mapper';
import { PickupService } from './pickup.service';

const pickupInclude = {
  driver: {
    select: {
      id: true,
      fullName: true,
      phone: true,
      vehicleType: true,
    },
  },
  user: {
    select: { id: true, fullName: true, phone: true },
  },
} as const;

@Injectable()
export class DriverPickupsService {
  private readonly log = new Logger(DriverPickupsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pickups: PickupService,
    private readonly platformSettings: PlatformSettingsService,
    private readonly notifications: OrderNotificationsPort,
    private readonly tracking: TrackingService,
  ) {}

  private async sharePercent(): Promise<number> {
    return this.platformSettings.getDriverDeliverySharePercent();
  }

  private normalizePagination(page: number, limit: number) {
    const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
    const safeLimit =
      Number.isFinite(limit) && limit > 0 ? Math.min(Math.floor(limit), 100) : 20;
    return { page: safePage, limit: safeLimit, skip: (safePage - 1) * safeLimit };
  }

  private async assertDriverActive(driverId: string) {
    const driver = await this.prisma.driver.findUnique({
      where: { id: driverId },
      select: { id: true, isActive: true },
    });
    if (!driver) {
      throw new NotFoundException('Driver not found');
    }
    if (!driver.isActive) {
      throw new ForbiddenException('Driver account is disabled');
    }
  }

  private async countActiveJobs(driverId: string, excludePickupId?: string) {
    const [orders, pickups, specials] = await Promise.all([
      this.prisma.order.count({
        where: {
          driverId,
          status: { in: ['DELIVERING', 'DISPATCHED'] },
        },
      }),
      this.prisma.pickupOrder.count({
        where: {
          driverId,
          status: { in: [...DRIVER_PICKUP_ACTIVE_STATUSES] },
          ...(excludePickupId ? { id: { not: excludePickupId } } : {}),
        },
      }),
      this.prisma.specialRequest.count({
        where: {
          driverId,
          status: { in: [...DRIVER_SPECIAL_REQUEST_ACTIVE_STATUSES] },
        },
      }),
    ]);
    return orders + pickups + specials;
  }

  private async notifyCustomer(
    pickupId: string,
    userId: string,
    status: string,
    title?: string,
    body?: string,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { fcmToken: true },
    });
    const token = user?.fcmToken?.trim();
    if (!token) {
      return;
    }
    await this.notifications.sendOrderStatusUpdate({
      fcmToken: token,
      orderId: pickupId,
      status,
      merchantName: 'Pickup',
      title,
      body,
      jobKind: 'pickup',
    });
  }

  private async syncTrackingMeta(
    pickupId: string,
    userId: string,
    driverId: string,
  ) {
    try {
      await this.tracking.syncOrderMeta(pickupId, userId, driverId);
    } catch (err) {
      this.log.warn(
        `syncOrderMeta failed for pickup ${pickupId}: ${String(err)}`,
      );
    }
  }

  async listAvailable(driverId: string, page = 1, limit = 20) {
    await this.assertDriverActive(driverId);
    await this.pickups.activateDueScheduled();
    const { page: p, limit: l, skip } = this.normalizePagination(page, limit);
    const offerMaxAgeMs = 72 * 60 * 60 * 1000;
    const where: Prisma.PickupOrderWhereInput = {
      driverId: null,
      status: { in: [...DRIVER_PICKUP_OFFER_STATUSES] },
      createdAt: { gte: new Date(Date.now() - offerMaxAgeMs) },
    };
    const [rows, total, sharePercent] = await Promise.all([
      this.prisma.pickupOrder.findMany({
        where,
        include: pickupInclude,
        orderBy: { createdAt: 'desc' },
        skip,
        take: l,
      }),
      this.prisma.pickupOrder.count({ where }),
      this.sharePercent(),
    ]);
    return {
      items: rows.map((row) =>
        withDriverEarnings(mapPickupOrder(row), sharePercent),
      ),
      total,
      page: p,
      limit: l,
    };
  }

  async listMine(driverId: string, page = 1, limit = 20) {
    await this.assertDriverActive(driverId);
    const { page: p, limit: l, skip } = this.normalizePagination(page, limit);
    const where = { driverId };
    const [rows, total, sharePercent] = await Promise.all([
      this.prisma.pickupOrder.findMany({
        where,
        include: pickupInclude,
        orderBy: { createdAt: 'desc' },
        skip,
        take: l,
      }),
      this.prisma.pickupOrder.count({ where }),
      this.sharePercent(),
    ]);
    return {
      items: rows.map((row) =>
        withDriverEarnings(mapPickupOrder(row), sharePercent),
      ),
      total,
      page: p,
      limit: l,
    };
  }

  async listActive(driverId: string) {
    await this.assertDriverActive(driverId);
    const [rows, sharePercent] = await Promise.all([
      this.prisma.pickupOrder.findMany({
        where: {
          driverId,
          status: { in: [...DRIVER_PICKUP_ACTIVE_STATUSES] },
        },
        include: pickupInclude,
        orderBy: { createdAt: 'asc' },
      }),
      this.sharePercent(),
    ]);
    return {
      items: rows.map((row) =>
        withDriverEarnings(mapPickupOrder(row), sharePercent),
      ),
    };
  }

  async getOne(driverId: string, pickupId: string) {
    await this.assertDriverActive(driverId);
    const row = await this.prisma.pickupOrder.findFirst({
      where: { id: pickupId, driverId },
      include: pickupInclude,
    });
    if (!row) {
      throw new NotFoundException('Pickup not found');
    }
    return withDriverEarnings(mapPickupOrder(row), await this.sharePercent());
  }

  async accept(driverId: string, pickupId: string) {
    await this.assertDriverActive(driverId);
    const activeCount = await this.countActiveJobs(driverId, pickupId);
    if (activeCount + 1 > MAX_DRIVER_BATCH_ORDERS) {
      throw new BadRequestException(
        `You can carry at most ${MAX_DRIVER_BATCH_ORDERS} jobs at once`,
      );
    }

    const updated = await this.prisma.pickupOrder.updateMany({
      where: {
        id: pickupId,
        driverId: null,
        status: { in: [...DRIVER_PICKUP_OFFER_STATUSES] },
      },
      data: { driverId, status: 'DELIVERING' },
    });

    if (updated.count === 0) {
      const existing = await this.prisma.pickupOrder.findUnique({
        where: { id: pickupId },
        select: { driverId: true, status: true },
      });
      if (!existing) {
        throw new NotFoundException('Pickup not found');
      }
      if (existing.driverId === driverId) {
        const pickup = await this.getOne(driverId, pickupId);
        if (pickup.customer?.id) {
          await this.syncTrackingMeta(pickupId, pickup.customer.id, driverId);
        }
        return {
          accepted: true as const,
          pickup,
        };
      }
      if (existing.driverId) {
        throw new ConflictException('Pickup already assigned to another driver');
      }
      throw new BadRequestException(
        `Pickup cannot be accepted in status ${normalizePickupStatus(existing.status)}`,
      );
    }

    const row = await this.prisma.pickupOrder.findFirst({
      where: { id: pickupId, driverId },
      include: pickupInclude,
    });
    await this.syncTrackingMeta(pickupId, row!.userId, driverId);
    void this.notifyCustomer(
      pickupId,
      row!.userId,
      'DELIVERING',
      'Driver on the way',
      'Your pickup driver is heading to the collection address.',
    );
    return {
      accepted: true as const,
      pickup: withDriverEarnings(mapPickupOrder(row!), await this.sharePercent()),
    };
  }

  async confirmCollected(driverId: string, pickupId: string) {
    await this.assertDriverActive(driverId);
    const updated = await this.prisma.pickupOrder.updateMany({
      where: { id: pickupId, driverId, status: 'DELIVERING' },
      data: { status: 'DISPATCHED' },
    });
    if (updated.count === 0) {
      throw new BadRequestException(
        'Pickup must be DELIVERING before confirming collection',
      );
    }
    const row = await this.prisma.pickupOrder.findFirst({
      where: { id: pickupId, driverId },
      include: pickupInclude,
    });
    void this.notifyCustomer(
      pickupId,
      row!.userId,
      'DISPATCHED',
      'Package collected',
      'Your driver collected the package and is heading to the drop-off.',
    );
    return {
      collected: true as const,
      pickup: withDriverEarnings(mapPickupOrder(row!), await this.sharePercent()),
    };
  }

  async complete(driverId: string, pickupId: string) {
    await this.assertDriverActive(driverId);
    const updated = await this.prisma.pickupOrder.updateMany({
      where: { id: pickupId, driverId, status: 'DISPATCHED' },
      data: { status: 'DELIVERED' },
    });
    if (updated.count === 0) {
      throw new BadRequestException(
        'Confirm collection at the from address before finishing delivery',
      );
    }
    const row = await this.prisma.pickupOrder.findFirst({
      where: { id: pickupId, driverId },
      include: pickupInclude,
    });
    void this.notifyCustomer(pickupId, row!.userId, 'DELIVERED');
    return {
      completed: true as const,
      pickup: withDriverEarnings(mapPickupOrder(row!), await this.sharePercent()),
    };
  }

  async assignByAdmin(pickupId: string, driverId: string) {
    await this.assertDriverActive(driverId);
    const existing = await this.prisma.pickupOrder.findUnique({
      where: { id: pickupId },
      select: { id: true, status: true, driverId: true },
    });
    if (!existing) {
      throw new NotFoundException('Pickup not found');
    }
    if (existing.driverId) {
      throw new ConflictException('Pickup already assigned to a driver');
    }
    const status = normalizePickupStatus(existing.status);
    if (status !== 'PENDING' && status !== 'SCHEDULED') {
      throw new BadRequestException(
        `Pickup cannot be assigned in status ${status}`,
      );
    }
    const activeCount = await this.countActiveJobs(driverId);
    if (activeCount + 1 > MAX_DRIVER_BATCH_ORDERS) {
      throw new BadRequestException(
        `Driver already has ${MAX_DRIVER_BATCH_ORDERS} active jobs`,
      );
    }
    const row = await this.prisma.pickupOrder.update({
      where: { id: pickupId },
      data: { driverId, status: 'DELIVERING' },
      include: pickupInclude,
    });
    await this.syncTrackingMeta(pickupId, row.userId, driverId);
    void this.notifyCustomer(
      pickupId,
      row.userId,
      'DELIVERING',
      'Driver assigned',
      'A driver was assigned to your pickup.',
    );
    return {
      assigned: true as const,
      pickup: withDriverEarnings(mapPickupOrder(row), await this.sharePercent()),
    };
  }

  async assertDriverOwnsPickup(driverId: string, pickupId: string) {
    const row = await this.prisma.pickupOrder.findUnique({
      where: { id: pickupId },
      select: { driverId: true, status: true },
    });
    if (!row) {
      throw new NotFoundException('Pickup not found');
    }
    if (row.driverId !== driverId) {
      throw new ForbiddenException('Not your pickup');
    }
    if (isTerminalPickupStatus(row.status)) {
      throw new BadRequestException('Pickup is already completed');
    }
    return row;
  }
}
