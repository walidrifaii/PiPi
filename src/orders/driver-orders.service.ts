import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  DRIVER_ACTIVE_STATUSES,
  DRIVER_OFFER_STATUSES,
  isDriverOfferStatus,
  isTerminalOrderStatus,
  normalizeOrderStatus,
} from './order-status.constants';
import { mapDriverOrderDetail, mapDriverOrderOffer } from './order-driver.mapper';
import { OrderWithRelations } from './order.types';

const driverOfferSelect = {
  id: true,
  status: true,
  deliveryFee: true,
  itemsSnapshot: true,
  createdAt: true,
  merchant: { select: { name: true } },
  user: { select: { fullName: true } },
  address: { select: { addressLine: true } },
} satisfies Prisma.OrderSelect;

const driverOrderInclude = {
  orderItems: { orderBy: { id: Prisma.SortOrder.asc }, take: 20 },
  merchant: { select: { id: true, name: true } },
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
  constructor(private readonly prisma: PrismaService) {}

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
    const where: Prisma.OrderWhereInput = {
      driverId: null,
      status: { in: [...DRIVER_OFFER_STATUSES] },
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

    return this.pagedResponse(
      rows.map((o) => mapDriverOrderOffer(o)),
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

    return {
      order: mapDriverOrderDetail(order as OrderWithRelations),
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

    return this.pagedResponse(
      rows.map((o) => mapDriverOrderOffer(o)),
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
    return mapDriverOrderDetail(order as OrderWithRelations);
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
      data: { driverId },
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
        return {
          accepted: true as const,
          order: mapDriverOrderDetail(order! as OrderWithRelations),
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

    return {
      accepted: true as const,
      order: mapDriverOrderDetail(order! as OrderWithRelations),
    };
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
