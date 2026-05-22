import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ListOrdersAdminQueryDto } from './dto/list-orders-admin-query.dto';
import { mapOrderDetail, mapOrderSummary } from './order.mapper';
import { OrderWithRelations } from './order.types';

const orderInclude = {
  orderItems: { orderBy: { id: Prisma.SortOrder.asc } },
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
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  private normalizePagination(page: number, limit: number) {
    const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
    const safeLimit =
      Number.isFinite(limit) && limit > 0
        ? Math.min(Math.floor(limit), 100)
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

  async listForUser(userId: string, page = 1, limit = 20) {
    const { page: p, limit: l, skip } = this.normalizePagination(page, limit);
    const where = { userId };
    const [rows, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        include: orderInclude,
        orderBy: { createdAt: 'desc' },
        skip,
        take: l,
      }),
      this.prisma.order.count({ where }),
    ]);
    return this.pagedResponse(
      rows.map((o) => mapOrderSummary(o as OrderWithRelations)),
      total,
      p,
      l,
    );
  }

  async getForUser(userId: string, orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, userId },
      include: orderInclude,
    });
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    return mapOrderDetail(order as OrderWithRelations);
  }

  async listForMerchant(merchantId: string, page = 1, limit = 20) {
    const { page: p, limit: l, skip } = this.normalizePagination(page, limit);
    const where = { merchantId };
    const [rows, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        include: orderInclude,
        orderBy: { createdAt: 'desc' },
        skip,
        take: l,
      }),
      this.prisma.order.count({ where }),
    ]);
    return this.pagedResponse(
      rows.map((o) => {
        const summary = mapOrderSummary(o as OrderWithRelations);
        const row = o as OrderWithRelations;
        return {
          ...summary,
          customer: row.user
            ? {
                id: row.user.id,
                fullName: row.user.fullName,
                phone: row.user.phone,
              }
            : null,
        };
      }),
      total,
      p,
      l,
    );
  }

  async getForMerchant(merchantId: string, orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, merchantId },
      include: orderInclude,
    });
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    return mapOrderDetail(order as OrderWithRelations, {
      includeCustomer: true,
    });
  }

  private buildSuperAdminOrdersWhere(
    query: ListOrdersAdminQueryDto,
  ): Prisma.OrderWhereInput {
    const where: Prisma.OrderWhereInput = {};

    if (query.merchantId) {
      where.merchantId = query.merchantId;
    }
    if (query.orderId) {
      where.id = query.orderId;
    }

    const userName = query.userName?.trim();
    const phone = query.number?.trim();
    if (userName || phone) {
      const userWhere: Prisma.UserWhereInput = {};
      if (userName) {
        userWhere.fullName = { contains: userName, mode: 'insensitive' };
      }
      if (phone) {
        userWhere.phone = { contains: phone };
      }
      where.user = userWhere;
    }

    return where;
  }

  private mapAdminOrderRow(o: OrderWithRelations) {
    const summary = mapOrderSummary(o);
    return {
      ...summary,
      userId: o.userId,
      customer: o.user
        ? {
            id: o.user.id,
            fullName: o.user.fullName,
            phone: o.user.phone,
          }
        : null,
      merchant: {
        id: o.merchant.id,
        name: o.merchant.name,
      },
    };
  }

  async listForSuperAdmin(query: ListOrdersAdminQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const { page: p, limit: l, skip } = this.normalizePagination(page, limit);
    const where = this.buildSuperAdminOrdersWhere(query);

    const rows = await this.prisma.order.findMany({
      where,
      include: orderInclude,
      orderBy: { createdAt: 'desc' },
      skip,
      take: l,
    });
    const total = await this.prisma.order.count({ where });

    return this.pagedResponse(
      rows.map((o) => this.mapAdminOrderRow(o as OrderWithRelations)),
      total,
      p,
      l,
    );
  }
}
