import {
  BadRequestException,
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
  computeMerchantEarningsFromFoodSubtotal,
  roundMoney,
} from '../platform-settings/driver-delivery-share';
import { ListOrdersAdminQueryDto } from './dto/list-orders-admin-query.dto';
import { MerchantEarningsQueryDto } from './dto/merchant-earnings-query.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { mapOrderDetail, mapOrderSummary } from './order.mapper';
import { resolveProductDisplayImage } from '../common/product-display-image';
import { PlatformSettingsService } from '../platform-settings/platform-settings.service';
import {
  canMerchantTransition,
  canSuperAdminTransition,
  isCustomerTrackableStatus,
  isTerminalOrderStatus,
  normalizeOrderStatus,
} from './order-status.constants';
import { OrderItemsSnapshot, OrderWithRelations } from './order.types';

const orderInclude = {
  orderItems: { orderBy: { id: Prisma.SortOrder.asc } },
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
  driver: {
    select: {
      id: true,
      fullName: true,
      phone: true,
      vehicleType: true,
    },
  },
} satisfies Prisma.OrderInclude;

@Injectable()
export class OrdersService {
  private readonly log = new Logger(OrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: OrderNotificationsPort,
    private readonly tracking: TrackingService,
    private readonly platformSettings: PlatformSettingsService,
  ) {}

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
    const row = order as OrderWithRelations;
    if (
      row.driverId &&
      isCustomerTrackableStatus(row.status)
    ) {
      await this.tracking
        .syncOrderMeta(orderId, userId, row.driverId)
        .catch(() => undefined);
    }
    return mapOrderDetail(row);
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
    const merchantFoodSharePercent =
      await this.platformSettings.getMerchantFoodSharePercent();

    return this.pagedResponse(
      rows.map((o) => {
        const summary = mapOrderSummary(
          o as OrderWithRelations,
          'merchant',
          merchantFoodSharePercent,
        );
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
    const row = order as OrderWithRelations;
    const productIds = [...new Set(row.orderItems.map((i) => i.productId))];
    const products =
      productIds.length > 0
        ? await this.prisma.product.findMany({
            where: { id: { in: productIds } },
            select: {
              id: true,
              imageUrl: true,
              images: {
                orderBy: { sortOrder: 'asc' },
                take: 1,
                select: { url: true },
              },
            },
          })
        : [];
    const productImages = new Map(
      products.map((p) => [p.id, resolveProductDisplayImage(p)]),
    );
    const merchantFoodSharePercent =
      await this.platformSettings.getMerchantFoodSharePercent();
    return mapOrderDetail(row, {
      includeCustomer: true,
      audience: 'merchant',
      productImages,
      merchantFoodSharePercent,
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
    const summary = mapOrderSummary(o, 'admin');
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

  private async notifyCustomerOrderStatus(
    order: OrderWithRelations,
    status: string,
  ) {
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
        status,
        merchantName,
      });

    if (!result.sent) {
      this.log.debug(
        `Order ${order.id} status push not sent: ${result.reason ?? 'unknown'}`,
      );
    }
  }

  async updateStatusForMerchant(
    merchantId: string,
    orderId: string,
    dto: UpdateOrderStatusDto,
  ) {
    return this.updateOrderStatus(orderId, dto.status, {
      merchantId,
      superAdmin: false,
    });
  }

  async updateStatusForSuperAdmin(orderId: string, dto: UpdateOrderStatusDto) {
    return this.updateOrderStatus(orderId, dto.status, {
      superAdmin: true,
    });
  }

  private async updateOrderStatus(
    orderId: string,
    newStatusRaw: string,
    scope: { merchantId?: string; superAdmin: boolean },
  ) {
    const newStatus = normalizeOrderStatus(newStatusRaw);

    const order = await this.prisma.order.findFirst({
      where: scope.merchantId
        ? { id: orderId, merchantId: scope.merchantId }
        : { id: orderId },
      include: orderInclude,
    });
    if (!order) {
      throw new NotFoundException('Order not found');
    }

    const current = normalizeOrderStatus(order.status);
    if (current === newStatus) {
      return mapOrderDetail(order as OrderWithRelations, {
        includeCustomer: scope.superAdmin || !!scope.merchantId,
        audience: scope.superAdmin
          ? 'admin'
          : scope.merchantId
            ? 'merchant'
            : 'customer',
      });
    }

    const canTransition = scope.superAdmin
      ? canSuperAdminTransition(current, newStatus)
      : canMerchantTransition(current, newStatus);

    if (!canTransition) {
      throw new BadRequestException(
        `Cannot change order status from ${current} to ${newStatus}`,
      );
    }

    if (!scope.superAdmin && isTerminalOrderStatus(current)) {
      throw new BadRequestException(`Order is already ${current}`);
    }

    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: { status: newStatus },
      include: orderInclude,
    });

    const row = updated as OrderWithRelations;
    await this.notifyCustomerOrderStatus(row, newStatus);

    if (newStatus === 'DELIVERING' && row.driverId) {
      void this.tracking
        .syncOrderMeta(orderId, row.userId, row.driverId)
        .catch(() => undefined);
    }

    return mapOrderDetail(row, {
      includeCustomer: scope.superAdmin || !!scope.merchantId,
      audience: scope.superAdmin
        ? 'admin'
        : scope.merchantId
          ? 'merchant'
          : 'customer',
    });
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

  private parseItemsSnapshot(raw: unknown): OrderItemsSnapshot | null {
    if (!raw || typeof raw !== 'object') {
      return null;
    }
    const snapshot = raw as OrderItemsSnapshot;
    if (!Array.isArray(snapshot.items)) {
      return null;
    }
    return snapshot;
  }

  private merchantGrossFoodFromRow(row: {
    itemsSnapshot: unknown;
    subtotal: { toString(): string } | null;
  }): number {
    const snapshot = this.parseItemsSnapshot(row.itemsSnapshot);
    if (snapshot?.merchantSubtotal !== undefined) {
      return roundMoney(snapshot.merchantSubtotal);
    }
    if (row.subtotal !== null) {
      return roundMoney(Number(row.subtotal));
    }
    return 0;
  }

  private earningsTrendPercent(
    current: number,
    previous: number,
  ): number | null {
    if (previous <= 0) {
      return current > 0 ? 100 : null;
    }
    return roundMoney(((current - previous) / previous) * 100);
  }

  private resolveMerchantEarningsPeriod(query: MerchantEarningsQueryDto) {
    const now = new Date();
    let from: Date;
    let to: Date;

    if (query.from) {
      from = new Date(query.from);
    } else {
      from = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    }

    if (query.to) {
      to = new Date(query.to);
    } else {
      to = now;
    }

    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      throw new BadRequestException('Invalid earnings date range');
    }
    if (from.getTime() > to.getTime()) {
      throw new BadRequestException('from must be before to');
    }

    return { from, to };
  }

  private startOfUtcDay(date: Date): Date {
    return new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
    );
  }

  private startOfUtcWeek(date: Date): Date {
    const day = this.startOfUtcDay(date);
    const weekday = day.getUTCDay();
    const diff = weekday === 0 ? 6 : weekday - 1;
    day.setUTCDate(day.getUTCDate() - diff);
    return day;
  }

  private utcDayKey(date: Date): string {
    return date.toISOString().slice(0, 10);
  }

  private aggregateMerchantEarningsRows(
    rows: Array<{
      id: string;
      checkoutRef: string | null;
      createdAt: Date;
      itemsSnapshot: unknown;
      subtotal: { toString(): string } | null;
    }>,
    sharePercent: number,
  ) {
    let totalRevenue = 0;
    let netEarnings = 0;

    for (const row of rows) {
      const gross = this.merchantGrossFoodFromRow(row);
      totalRevenue += gross;
      netEarnings += computeMerchantEarningsFromFoodSubtotal(gross, sharePercent);
    }

    const orderCount = rows.length;
    const avgOrderValue =
      orderCount > 0 ? roundMoney(netEarnings / orderCount) : 0;

    return {
      totalRevenue: roundMoney(totalRevenue),
      netEarnings: roundMoney(netEarnings),
      avgOrderValue,
      orderCount,
      platformFee: roundMoney(totalRevenue - netEarnings),
    };
  }

  private buildDailyChart(
    rows: Array<{
      createdAt: Date;
      itemsSnapshot: unknown;
      subtotal: { toString(): string } | null;
    }>,
    sharePercent: number,
    from: Date,
    to: Date,
  ) {
    const buckets = new Map<
      string,
      { revenue: number; netEarnings: number; orderCount: number }
    >();

    for (
      let cursor = this.startOfUtcDay(from);
      cursor.getTime() <= to.getTime();
      cursor.setUTCDate(cursor.getUTCDate() + 1)
    ) {
      buckets.set(this.utcDayKey(cursor), {
        revenue: 0,
        netEarnings: 0,
        orderCount: 0,
      });
    }

    for (const row of rows) {
      const key = this.utcDayKey(row.createdAt);
      const bucket = buckets.get(key);
      if (!bucket) {
        continue;
      }
      const gross = this.merchantGrossFoodFromRow(row);
      bucket.revenue = roundMoney(bucket.revenue + gross);
      bucket.netEarnings = roundMoney(
        bucket.netEarnings +
          computeMerchantEarningsFromFoodSubtotal(gross, sharePercent),
      );
      bucket.orderCount += 1;
    }

    return Array.from(buckets.entries()).map(([date, values]) => ({
      date,
      label: new Date(`${date}T12:00:00.000Z`).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        timeZone: 'UTC',
      }),
      revenue: values.revenue,
      netEarnings: values.netEarnings,
      orderCount: values.orderCount,
    }));
  }

  private buildWeeklySettlements(
    rows: Array<{
      createdAt: Date;
      itemsSnapshot: unknown;
      subtotal: { toString(): string } | null;
    }>,
    sharePercent: number,
    weeks = 4,
  ) {
    const now = new Date();
    const currentWeekStart = this.startOfUtcWeek(now);
    const weekStarts: Date[] = [];

    for (let i = weeks - 1; i >= 0; i -= 1) {
      const start = new Date(currentWeekStart);
      start.setUTCDate(start.getUTCDate() - i * 7);
      weekStarts.push(start);
    }

    const buckets = weekStarts.map((start) => {
      const end = new Date(start);
      end.setUTCDate(end.getUTCDate() + 6);
      end.setUTCHours(23, 59, 59, 999);
      return {
        periodStart: start.toISOString(),
        periodEnd: end.toISOString(),
        amount: 0,
        orderCount: 0,
        status: end.getTime() < now.getTime() ? 'COMPLETED' : 'IN_PROGRESS',
      };
    });

    for (const row of rows) {
      const createdAt = row.createdAt.getTime();
      for (const bucket of buckets) {
        const start = new Date(bucket.periodStart).getTime();
        const end = new Date(bucket.periodEnd).getTime();
        if (createdAt >= start && createdAt <= end) {
          const gross = this.merchantGrossFoodFromRow(row);
          bucket.amount = roundMoney(
            bucket.amount +
              computeMerchantEarningsFromFoodSubtotal(gross, sharePercent),
          );
          bucket.orderCount += 1;
          break;
        }
      }
    }

    return buckets
      .filter((bucket) => bucket.orderCount > 0)
      .reverse()
      .map((bucket, index) => {
        const start = new Date(bucket.periodStart);
        const id = `WK-${start.getUTCFullYear()}${String(start.getUTCMonth() + 1).padStart(2, '0')}${String(start.getUTCDate()).padStart(2, '0')}`;
        return {
          id,
          label: start.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            timeZone: 'UTC',
          }),
          periodStart: bucket.periodStart,
          periodEnd: bucket.periodEnd,
          amount: bucket.amount,
          orderCount: bucket.orderCount,
          status: bucket.status,
          displayIndex: index + 1,
        };
      });
  }

  async getMerchantEarnings(
    merchantId: string,
    query: MerchantEarningsQueryDto,
  ) {
    const { from, to } = this.resolveMerchantEarningsPeriod(query);
    const durationMs = to.getTime() - from.getTime() + 1;
    const prevTo = new Date(from.getTime() - 1);
    const prevFrom = new Date(prevTo.getTime() - durationMs + 1);

    const settlementWeeks = 4;
    const settlementFrom = new Date(this.startOfUtcWeek(new Date()));
    settlementFrom.setUTCDate(
      settlementFrom.getUTCDate() - (settlementWeeks - 1) * 7,
    );

    const fetchFrom =
      prevFrom.getTime() < settlementFrom.getTime()
        ? prevFrom
        : settlementFrom;

    const earningsSelect = {
      id: true,
      checkoutRef: true,
      createdAt: true,
      itemsSnapshot: true,
      subtotal: true,
    } satisfies Prisma.OrderSelect;

    const [sharePercent, rows] = await Promise.all([
      this.platformSettings.getMerchantFoodSharePercent(),
      this.prisma.order.findMany({
        where: {
          merchantId,
          status: 'DELIVERED',
          createdAt: { gte: fetchFrom, lte: to },
        },
        select: earningsSelect,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const inRange = (row: { createdAt: Date }, start: Date, end: Date) =>
      row.createdAt.getTime() >= start.getTime() &&
      row.createdAt.getTime() <= end.getTime();

    const currentRows = rows.filter((row) => inRange(row, from, to));
    const previousRows = rows.filter((row) => inRange(row, prevFrom, prevTo));
    const settlementRows = rows.filter((row) =>
      inRange(row, settlementFrom, to),
    );

    const current = this.aggregateMerchantEarningsRows(
      currentRows,
      sharePercent,
    );
    const previous = this.aggregateMerchantEarningsRows(
      previousRows,
      sharePercent,
    );

    const periodLabel = from.toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    });

    return {
      period: {
        from: from.toISOString(),
        to: to.toISOString(),
        label: periodLabel,
      },
      merchantFoodSharePercent: sharePercent,
      totalRevenue: current.totalRevenue,
      netEarnings: current.netEarnings,
      avgOrderValue: current.avgOrderValue,
      orderCount: current.orderCount,
      platformFee: current.platformFee,
      trends: {
        totalRevenuePercent: this.earningsTrendPercent(
          current.totalRevenue,
          previous.totalRevenue,
        ),
        netEarningsPercent: this.earningsTrendPercent(
          current.netEarnings,
          previous.netEarnings,
        ),
        avgOrderValuePercent: this.earningsTrendPercent(
          current.avgOrderValue,
          previous.avgOrderValue,
        ),
      },
      chart: this.buildDailyChart(currentRows, sharePercent, from, to),
      recentSettlements: this.buildWeeklySettlements(
        settlementRows,
        sharePercent,
        settlementWeeks,
      ),
      updatedAt: new Date().toISOString(),
    };
  }
}
