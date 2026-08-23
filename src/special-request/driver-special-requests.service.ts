import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { MAX_DRIVER_BATCH_ORDERS } from '../orders/order-status.constants';
import { OrderNotificationsPort } from '../notifications/notifications.port';
import { PlatformSettingsService } from '../platform-settings/platform-settings.service';
import { PrismaService } from '../prisma/prisma.service';
import { DRIVER_PICKUP_ACTIVE_STATUSES } from '../pickup/pickup.constants';
import {
  DRIVER_SPECIAL_REQUEST_ACTIVE_STATUSES,
  DRIVER_SPECIAL_REQUEST_OFFER_STATUSES,
  isTerminalSpecialRequestStatus,
  normalizeSpecialRequestStatus,
} from './special-request.constants';
import { mapSpecialRequest, withDriverEarnings } from './special-request.mapper';
import { specialRequestInclude } from './special-request.service';

@Injectable()
export class DriverSpecialRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly platformSettings: PlatformSettingsService,
    private readonly notifications: OrderNotificationsPort,
  ) {}

  private async sharePercent(): Promise<number> {
    return this.platformSettings.getDriverDeliverySharePercent();
  }

  private normalizePagination(page: number, limit: number) {
    const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
    const safeLimit =
      Number.isFinite(limit) && limit > 0
        ? Math.min(Math.floor(limit), 100)
        : 20;
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

  private async countActiveJobs(driverId: string, excludeRequestId?: string) {
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
        },
      }),
      this.prisma.specialRequest.count({
        where: {
          driverId,
          status: { in: [...DRIVER_SPECIAL_REQUEST_ACTIVE_STATUSES] },
          ...(excludeRequestId ? { id: { not: excludeRequestId } } : {}),
        },
      }),
    ]);
    return orders + pickups + specials;
  }

  private async notifyCustomer(
    requestId: string,
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
      orderId: requestId,
      status,
      merchantName: 'Special Request',
      title,
      body,
    });
  }

  async listAvailable(driverId: string, page = 1, limit = 20) {
    await this.assertDriverActive(driverId);
    const { page: p, limit: l, skip } = this.normalizePagination(page, limit);
    const offerMaxAgeMs = 72 * 60 * 60 * 1000;
    const where: Prisma.SpecialRequestWhereInput = {
      driverId: null,
      status: { in: [...DRIVER_SPECIAL_REQUEST_OFFER_STATUSES] },
      createdAt: { gte: new Date(Date.now() - offerMaxAgeMs) },
    };
    const [rows, total, sharePercent] = await Promise.all([
      this.prisma.specialRequest.findMany({
        where,
        include: specialRequestInclude,
        orderBy: { createdAt: 'desc' },
        skip,
        take: l,
      }),
      this.prisma.specialRequest.count({ where }),
      this.sharePercent(),
    ]);
    return {
      items: rows.map((row) =>
        withDriverEarnings(mapSpecialRequest(row), sharePercent),
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
      this.prisma.specialRequest.findMany({
        where,
        include: specialRequestInclude,
        orderBy: { createdAt: 'desc' },
        skip,
        take: l,
      }),
      this.prisma.specialRequest.count({ where }),
      this.sharePercent(),
    ]);
    return {
      items: rows.map((row) =>
        withDriverEarnings(mapSpecialRequest(row), sharePercent),
      ),
      total,
      page: p,
      limit: l,
    };
  }

  async listActive(driverId: string) {
    await this.assertDriverActive(driverId);
    const [rows, sharePercent] = await Promise.all([
      this.prisma.specialRequest.findMany({
        where: {
          driverId,
          status: { in: [...DRIVER_SPECIAL_REQUEST_ACTIVE_STATUSES] },
        },
        include: specialRequestInclude,
        orderBy: { createdAt: 'asc' },
      }),
      this.sharePercent(),
    ]);
    return {
      items: rows.map((row) =>
        withDriverEarnings(mapSpecialRequest(row), sharePercent),
      ),
    };
  }

  async getOne(driverId: string, requestId: string) {
    await this.assertDriverActive(driverId);
    const row = await this.prisma.specialRequest.findFirst({
      where: { id: requestId, driverId },
      include: specialRequestInclude,
    });
    if (!row) {
      throw new NotFoundException('Special request not found');
    }
    return withDriverEarnings(mapSpecialRequest(row), await this.sharePercent());
  }

  async accept(driverId: string, requestId: string) {
    await this.assertDriverActive(driverId);
    const activeCount = await this.countActiveJobs(driverId, requestId);
    if (activeCount + 1 > MAX_DRIVER_BATCH_ORDERS) {
      throw new BadRequestException(
        `You can carry at most ${MAX_DRIVER_BATCH_ORDERS} jobs at once`,
      );
    }

    const updated = await this.prisma.specialRequest.updateMany({
      where: {
        id: requestId,
        driverId: null,
        status: { in: [...DRIVER_SPECIAL_REQUEST_OFFER_STATUSES] },
      },
      data: { driverId, status: 'DELIVERING' },
    });

    if (updated.count === 0) {
      const existing = await this.prisma.specialRequest.findUnique({
        where: { id: requestId },
        select: { driverId: true, status: true },
      });
      if (!existing) {
        throw new NotFoundException('Special request not found');
      }
      if (existing.driverId === driverId) {
        return this.getOne(driverId, requestId).then((request) => ({
          accepted: true as const,
          request,
        }));
      }
      if (existing.driverId) {
        throw new ConflictException(
          'Special request already assigned to another driver',
        );
      }
      throw new BadRequestException(
        `Special request cannot be accepted in status ${normalizeSpecialRequestStatus(existing.status)}`,
      );
    }

    const row = await this.prisma.specialRequest.findFirst({
      where: { id: requestId, driverId },
      include: specialRequestInclude,
    });
    void this.notifyCustomer(
      requestId,
      row!.userId,
      'DELIVERING',
      'Driver on the way',
      'Your driver is heading to the store for your special request.',
    );
    return {
      accepted: true as const,
      request: withDriverEarnings(
        mapSpecialRequest(row!),
        await this.sharePercent(),
      ),
    };
  }

  async confirmCollected(driverId: string, requestId: string) {
    await this.assertDriverActive(driverId);
    const updated = await this.prisma.specialRequest.updateMany({
      where: { id: requestId, driverId, status: 'DELIVERING' },
      data: { status: 'DISPATCHED' },
    });
    if (updated.count === 0) {
      throw new BadRequestException(
        'Special request must be DELIVERING before confirming collection',
      );
    }
    const row = await this.prisma.specialRequest.findFirst({
      where: { id: requestId, driverId },
      include: specialRequestInclude,
    });
    void this.notifyCustomer(
      requestId,
      row!.userId,
      'DISPATCHED',
      'Item collected',
      'Your driver bought the item and is heading to you.',
    );
    return {
      collected: true as const,
      request: withDriverEarnings(
        mapSpecialRequest(row!),
        await this.sharePercent(),
      ),
    };
  }

  async complete(driverId: string, requestId: string) {
    await this.assertDriverActive(driverId);
    const updated = await this.prisma.specialRequest.updateMany({
      where: { id: requestId, driverId, status: 'DISPATCHED' },
      data: { status: 'DELIVERED' },
    });
    if (updated.count === 0) {
      throw new BadRequestException(
        'Confirm collection at the store before finishing delivery',
      );
    }
    const row = await this.prisma.specialRequest.findFirst({
      where: { id: requestId, driverId },
      include: specialRequestInclude,
    });
    void this.notifyCustomer(requestId, row!.userId, 'DELIVERED');
    return {
      completed: true as const,
      request: withDriverEarnings(
        mapSpecialRequest(row!),
        await this.sharePercent(),
      ),
    };
  }

  async assignByAdmin(requestId: string, driverId: string) {
    await this.assertDriverActive(driverId);
    const existing = await this.prisma.specialRequest.findUnique({
      where: { id: requestId },
      select: { id: true, status: true, driverId: true },
    });
    if (!existing) {
      throw new NotFoundException('Special request not found');
    }
    if (existing.driverId) {
      throw new ConflictException('Special request already assigned to a driver');
    }
    const status = normalizeSpecialRequestStatus(existing.status);
    if (status !== 'PENDING') {
      throw new BadRequestException(
        `Special request cannot be assigned in status ${status}`,
      );
    }
    const activeCount = await this.countActiveJobs(driverId);
    if (activeCount + 1 > MAX_DRIVER_BATCH_ORDERS) {
      throw new BadRequestException(
        `Driver already has ${MAX_DRIVER_BATCH_ORDERS} active jobs`,
      );
    }
    const row = await this.prisma.specialRequest.update({
      where: { id: requestId },
      data: { driverId, status: 'DELIVERING' },
      include: specialRequestInclude,
    });
    void this.notifyCustomer(
      requestId,
      row.userId,
      'DELIVERING',
      'Driver assigned',
      'A driver was assigned to your special request.',
    );
    return {
      assigned: true as const,
      request: withDriverEarnings(
        mapSpecialRequest(row),
        await this.sharePercent(),
      ),
    };
  }

  async assertDriverOwnsRequest(driverId: string, requestId: string) {
    const row = await this.prisma.specialRequest.findUnique({
      where: { id: requestId },
      select: { driverId: true, status: true },
    });
    if (!row) {
      throw new NotFoundException('Special request not found');
    }
    if (row.driverId !== driverId) {
      throw new ForbiddenException('Not your special request');
    }
    if (isTerminalSpecialRequestStatus(row.status)) {
      throw new BadRequestException('Special request is already completed');
    }
    return row;
  }
}
