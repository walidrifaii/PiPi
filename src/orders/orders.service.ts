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
import { UserNotificationsService } from '../notifications/user-notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { TrackingService } from '../tracking/tracking.service';
import { DriverOffersLiveService } from '../tracking/driver-offers-live.service';
import {
  computeMerchantEarningsFromFoodSubtotal,
  roundMoney,
} from '../platform-settings/driver-delivery-share';
import { ListOrdersAdminQueryDto } from './dto/list-orders-admin-query.dto';
import { ListMerchantOrdersHistoryQueryDto } from './dto/list-merchant-orders-history-query.dto';
import { MerchantEarningsQueryDto } from './dto/merchant-earnings-query.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { mapOrderDetail, mapOrderSummary } from './order.mapper';
import { resolveProductDisplayImage } from '../common/product-display-image';
import { PlatformSettingsService } from '../platform-settings/platform-settings.service';
import { EarningsSettlementsService } from './earnings-settlements.service';
import { parseSettlementOrderIds } from './earnings-settlement.constants';
import {
  canMerchantTransition,
  canSuperAdminTransition,
  isCustomerTrackableStatus,
  isTerminalOrderStatus,
  MERCHANT_HISTORY_ORDER_STATUSES,
  normalizeOrderStatus,
} from './order-status.constants';
import { OrderItemsSnapshot, OrderWithRelations } from './order.types';

const orderInclude = {
  orderItems: { orderBy: { id: Prisma.SortOrder.asc } },
  merchant: { select: { id: true, name: true, nameAr: true, imageUrl: true, latitude: true, longitude: true } },
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
    private readonly userNotifications: UserNotificationsService,
    private readonly tracking: TrackingService,
    private readonly driverOffersLive: DriverOffersLiveService,
    private readonly platformSettings: PlatformSettingsService,
    private readonly settlements: EarningsSettlementsService,
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

  private async mapMerchantOrderList(
    merchantId: string,
    rows: OrderWithRelations[],
    total: number,
    page: number,
    limit: number,
  ) {
    const merchantFoodSharePercent =
      await this.platformSettings.getMerchantFoodSharePercentForMerchant(
        merchantId,
      );

    return this.pagedResponse(
      rows.map((o) => {
        const summary = mapOrderSummary(
          o,
          'merchant',
          merchantFoodSharePercent,
        );
        return {
          ...summary,
          customer: o.user
            ? {
                id: o.user.id,
                fullName: o.user.fullName,
                phone: o.user.phone,
              }
            : null,
        };
      }),
      total,
      page,
      limit,
    );
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
    return this.mapMerchantOrderList(
      merchantId,
      rows as OrderWithRelations[],
      total,
      p,
      l,
    );
  }

  async listHistoryForMerchant(
    merchantId: string,
    query: ListMerchantOrdersHistoryQueryDto = {},
  ) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const { page: p, limit: l, skip } = this.normalizePagination(page, limit);
    const where = await this.buildMerchantHistoryWhere(merchantId, query);
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
    return this.mapMerchantOrderList(
      merchantId,
      rows as OrderWithRelations[],
      total,
      p,
      l,
    );
  }

  private merchantHistoryStatuses(
    query: ListMerchantOrdersHistoryQueryDto,
  ): readonly string[] {
    if (query.status === 'Delivered') {
      return ['DELIVERED'];
    }
    if (query.status === 'Cancelled') {
      return ['CANCELLED'];
    }
    return [...MERCHANT_HISTORY_ORDER_STATUSES];
  }

  private async buildMerchantHistoryWhere(
    merchantId: string,
    query: ListMerchantOrdersHistoryQueryDto,
  ): Promise<Prisma.OrderWhereInput> {
    const historyStatuses = this.merchantHistoryStatuses(query);
    const where: Prisma.OrderWhereInput = {
      merchantId,
      status:
        historyStatuses.length === 1
          ? historyStatuses[0]
          : { in: [...historyStatuses] },
    };

    const search = query.search?.trim();
    if (!search) {
      return this.applyMerchantHistoryDateFilter(where, query);
    }

    const fullUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const orderIdFilters: Prisma.OrderWhereInput[] = [
      { checkoutRef: { contains: search, mode: 'insensitive' } },
    ];
    if (fullUuid.test(search)) {
      orderIdFilters.unshift({ id: search.toLowerCase() });
    } else if (/^[0-9a-f-]+$/i.test(search)) {
      const matchingIds = await this.prisma.$queryRaw<{ id: string }[]>`
        SELECT id FROM orders
        WHERE merchant_id = ${merchantId}::uuid
          AND status = ANY(${[...historyStatuses]})
          AND id::text ILIKE ${`${search.toLowerCase()}%`}
      `;
      if (matchingIds.length > 0) {
        orderIdFilters.unshift({
          id: { in: matchingIds.map((row) => row.id) },
        });
      }
    }

    return this.applyMerchantHistoryDateFilter(
      {
        ...where,
        OR: [
          ...orderIdFilters,
          { user: { fullName: { contains: search, mode: 'insensitive' } } },
        ],
      },
      query,
    );
  }

  private applyMerchantHistoryDateFilter(
    where: Prisma.OrderWhereInput,
    query: ListMerchantOrdersHistoryQueryDto,
  ): Prisma.OrderWhereInput {
    const createdAt: Prisma.DateTimeFilter = {};
    if (query.from) {
      createdAt.gte = new Date(query.from);
    }
    if (query.to) {
      createdAt.lte = new Date(query.to);
    }
    if (Object.keys(createdAt).length === 0) {
      return where;
    }
    return { ...where, createdAt };
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
      await this.platformSettings.getMerchantFoodSharePercentForMerchant(
        merchantId,
      );
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
    const snapshot = this.parseSnapshot(order.itemsSnapshot);
    const merchantName = snapshot?.merchantName ?? order.merchant.name;
    const merchantNameAr = order.merchant.nameAr ?? null;

    const copy = await this.userNotifications.createFromOrderStatus({
      userId: order.userId,
      orderId: order.id,
      status,
      merchantName,
      merchantNameAr,
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
        status,
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

  /** Push + RTDB when merchant accepts — drivers see offers without refresh. */
  private async notifyDriversNewOffer(order: OrderWithRelations) {
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
        `Driver offer RTDB publish failed for ${order.id}: ${err instanceof Error ? err.message : err}`,
      );
    }

    try {
      const drivers = await this.prisma.driver.findMany({
        where: { isActive: true, fcmToken: { not: null } },
        select: { fcmToken: true },
      });
      const tokens = drivers
        .map((d) => d.fcmToken?.trim())
        .filter((t): t is string => !!t && t.length > 0);

      if (tokens.length === 0) {
        return;
      }

      const result = await this.notifications.sendDriverOfferAlert({
        tokens,
        orderId: order.id,
        merchantId: order.merchantId,
        merchantName,
        deliveryFee,
      });

      if (!result.sent) {
        this.log.debug(
          `Driver offer push for ${order.id} not sent: ${result.reason ?? 'unknown'}`,
        );
      }
    } catch (err) {
      this.log.warn(
        `Driver offer push failed for ${order.id}: ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  private async clearDriverOfferLive(orderId: string) {
    try {
      await this.driverOffersLive.removeOffer(orderId);
    } catch (err) {
      this.log.warn(
        `Driver offer RTDB remove failed for ${orderId}: ${err instanceof Error ? err.message : err}`,
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
      preparationTime: dto.preparationTime,
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
    scope: {
      merchantId?: string;
      superAdmin: boolean;
      preparationTime?: number;
    },
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
      data: {
        status: newStatus,
        ...(newStatus === 'ACCEPTED' && scope.preparationTime
          ? { preparationTime: scope.preparationTime }
          : {}),
      },
      include: orderInclude,
    });

    const row = updated as OrderWithRelations;
    await this.notifyCustomerOrderStatus(row, newStatus);

    if (newStatus === 'ACCEPTED') {
      void this.notifyDriversNewOffer(row);
    } else {
      void this.clearDriverOfferLive(orderId);
    }

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

    if (query.last15Days) {
      const from = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() - 14,
        0,
        0,
        0,
        0,
      );
      return { from, to: now };
    }

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

  /** Date filter for settlement lists; omit params to return all settlements. */
  private resolveOptionalSettlementsPeriod(
    query: MerchantEarningsQueryDto,
  ): { from: Date; to: Date } | undefined {
    if (query.last15Days) {
      return this.resolveMerchantEarningsPeriod(query);
    }

    if (!query.from && !query.to) {
      return undefined;
    }

    const now = new Date();
    const from = query.from ? new Date(query.from) : new Date(0);
    const to = query.to ? new Date(query.to) : now;

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

  private filterUnpaidMerchantRows<
    T extends { id: string },
  >(rows: T[], paidOrderIds: Set<string>): T[] {
    return rows.filter((row) => !paidOrderIds.has(row.id));
  }

  async getMerchantEarnings(
    merchantId: string,
    query: MerchantEarningsQueryDto,
    options: { forAdmin?: boolean } = {},
  ) {
    const { from, to } = this.resolveMerchantEarningsPeriod(query);
    const durationMs = to.getTime() - from.getTime() + 1;
    const prevTo = new Date(from.getTime() - 1);
    const prevFrom = new Date(prevTo.getTime() - durationMs + 1);

    const earningsSelect = {
      id: true,
      checkoutRef: true,
      createdAt: true,
      itemsSnapshot: true,
      subtotal: true,
    } satisfies Prisma.OrderSelect;

    const [sharePercent, paidOrderIds, rows, paidSettlements] =
      await Promise.all([
        this.platformSettings.getMerchantFoodSharePercentForMerchant(merchantId),
        this.settlements.getPaidOrderIds('MERCHANT', merchantId),
        this.prisma.order.findMany({
          where: {
            merchantId,
            status: 'DELIVERED',
            createdAt: { gte: prevFrom, lte: to },
          },
          select: earningsSelect,
          orderBy: { createdAt: 'desc' },
        }),
        this.settlements.listSettlements('MERCHANT', merchantId),
      ]);

    const inRange = (row: { createdAt: Date }, start: Date, end: Date) =>
      row.createdAt.getTime() >= start.getTime() &&
      row.createdAt.getTime() <= end.getTime();

    const currentRowsAll = rows.filter((row) => inRange(row, from, to));
    const previousRowsAll = rows.filter((row) =>
      inRange(row, prevFrom, prevTo),
    );
    const currentRows = this.filterUnpaidMerchantRows(
      currentRowsAll,
      paidOrderIds,
    );
    const previousRows = this.filterUnpaidMerchantRows(
      previousRowsAll,
      paidOrderIds,
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

    const recentSettlements = paidSettlements.slice(0, 4).map((settlement) => ({
      id: settlement.referenceCode,
      label: new Date(settlement.paidAt).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        timeZone: 'UTC',
      }),
      periodStart: settlement.periodFrom,
      periodEnd: settlement.periodTo,
      amount: settlement.netAmount,
      orderCount: settlement.orderCount,
      status: 'COMPLETED' as const,
      displayIndex: 0,
    }));

    const result: Record<string, unknown> = {
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
      ...(options.forAdmin ? { platformFee: current.platformFee } : {}),
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
      recentSettlements,
      updatedAt: new Date().toISOString(),
    };

    if (options.forAdmin) {
      let totalPaidEarnings = 0;
      for (const row of currentRowsAll) {
        if (!paidOrderIds.has(row.id)) {
          continue;
        }
        const gross = this.merchantGrossFoodFromRow(row);
        totalPaidEarnings += computeMerchantEarningsFromFoodSubtotal(
          gross,
          sharePercent,
        );
      }
      result.totalPaidEarnings = roundMoney(totalPaidEarnings);
      result.paidOrderCount = currentRowsAll.length - currentRows.length;
      result.settlements = paidSettlements;
    }

    return result;
  }

  private formatOrderDisplayId(
    orderId: string,
    checkoutRef?: string | null,
  ): string {
    const ref = checkoutRef?.trim();
    if (ref) {
      return ref.length > 8 ? ref.slice(-8).toUpperCase() : ref.toUpperCase();
    }
    return orderId.slice(0, 8).toUpperCase();
  }

  private mapMerchantSettlementView(settlement: {
    id: string;
    referenceCode: string;
    periodFrom: Date | string;
    periodTo: Date | string;
    grossAmount: number;
    netAmount: number;
    platformFee?: number;
    orderCount: number;
    status: string;
    paidAt: Date | string;
  }) {
    const grossAmount = Number(settlement.grossAmount);
    const netAmount = Number(settlement.netAmount);
    const platformFee =
      settlement.platformFee != null
        ? Number(settlement.platformFee)
        : Math.max(0, grossAmount - netAmount);

    return {
      id: settlement.id,
      referenceCode: settlement.referenceCode,
      periodFrom:
        typeof settlement.periodFrom === 'string'
          ? settlement.periodFrom
          : settlement.periodFrom.toISOString(),
      periodTo:
        typeof settlement.periodTo === 'string'
          ? settlement.periodTo
          : settlement.periodTo.toISOString(),
      grossAmount,
      netAmount,
      platformFee,
      orderCount: settlement.orderCount,
      status: settlement.status,
      paidAt:
        typeof settlement.paidAt === 'string'
          ? settlement.paidAt
          : settlement.paidAt.toISOString(),
    };
  }

  private buildMerchantOrderEarningsList(
    rows: Array<{
      id: string;
      checkoutRef: string | null;
      createdAt: Date;
      itemsSnapshot: unknown;
      subtotal: { toString(): string } | null;
    }>,
    sharePercent: number,
    paidOrderIds: Set<string>,
    options: { forAdmin?: boolean; includePlatformFee?: boolean } = {},
  ) {
    const includePlatformFee = options.includePlatformFee !== false;
    const mapped = rows.map((row) => {
      const gross = this.merchantGrossFoodFromRow(row);
      const net = computeMerchantEarningsFromFoodSubtotal(gross, sharePercent);
      const isPaid = paidOrderIds.has(row.id);
      return {
        id: row.id,
        displayId: this.formatOrderDisplayId(row.id, row.checkoutRef),
        completedAt: row.createdAt.toISOString(),
        grossFood: gross,
        netEarnings: net,
        ...(includePlatformFee
          ? { platformFee: roundMoney(Math.max(0, gross - net)) }
          : {}),
        payoutStatus: isPaid ? ('PAID' as const) : ('UNPAID' as const),
      };
    });

    if (options.forAdmin) {
      return mapped;
    }

    return mapped.filter((order) => order.payoutStatus === 'UNPAID');
  }

  async getMerchantEarningsForAdmin(
    merchantId: string,
    query: MerchantEarningsQueryDto,
  ) {
    const merchant = await this.prisma.merchant.findUnique({
      where: { id: merchantId },
      select: {
        id: true,
        name: true,
        isActive: true,
        foodSharePercent: true,
      },
    });
    if (!merchant) {
      throw new NotFoundException('Merchant not found');
    }

    const { from, to } = this.resolveMerchantEarningsPeriod(query);
    const earningsSelect = {
      id: true,
      checkoutRef: true,
      createdAt: true,
      itemsSnapshot: true,
      subtotal: true,
    } satisfies Prisma.OrderSelect;

    const [summary, sharePercent, paidOrderIds, orderRows] = await Promise.all([
      this.getMerchantEarnings(merchantId, query, { forAdmin: true }),
      this.platformSettings.getMerchantFoodSharePercentForMerchant(merchantId),
      this.settlements.getPaidOrderIds('MERCHANT', merchantId),
      this.prisma.order.findMany({
        where: {
          merchantId,
          status: 'DELIVERED',
          createdAt: { gte: from, lte: to },
        },
        select: earningsSelect,
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
    ]);

    return {
      ...summary,
      merchant: {
        id: merchant.id,
        name: merchant.name,
        isActive: merchant.isActive,
        foodSharePercent:
          merchant.foodSharePercent != null
            ? Number(merchant.foodSharePercent)
            : null,
      },
      orders: this.buildMerchantOrderEarningsList(
        orderRows,
        sharePercent,
        paidOrderIds,
        { forAdmin: true },
      ),
    };
  }

  async listMerchantSettlements(
    merchantId: string,
    query: MerchantEarningsQueryDto,
  ) {
    const period = this.resolveOptionalSettlementsPeriod(query);
    const { page: p, limit: l } = this.normalizePagination(
      query.page ?? 1,
      query.limit ?? 20,
    );

    const { items, total } = await this.settlements.listSettlementsPaged(
      'MERCHANT',
      merchantId,
      {
        from: period?.from,
        to: period?.to,
        page: p,
        limit: l,
      },
    );

    return {
      ...(period
        ? {
            period: {
              from: period.from.toISOString(),
              to: period.to.toISOString(),
            },
          }
        : {}),
      ...this.pagedResponse(
        items.map((item) => this.mapMerchantSettlementView(item)),
        total,
        p,
        l,
      ),
    };
  }

  async getMerchantSettlementOrders(
    merchantId: string,
    settlementId: string,
    page = 1,
    limit = 20,
  ) {
    const settlementRow = await this.settlements.findMerchantSettlement(
      merchantId,
      settlementId,
    );
    const { page: p, limit: l, skip } = this.normalizePagination(page, limit);

    const earningsSelect = {
      id: true,
      checkoutRef: true,
      createdAt: true,
      itemsSnapshot: true,
      subtotal: true,
    } satisfies Prisma.OrderSelect;

    const orderIds = parseSettlementOrderIds(settlementRow.orderIds);
    if (orderIds.length === 0) {
      return {
        settlement: this.mapMerchantSettlementView({
          id: settlementRow.id,
          referenceCode: settlementRow.referenceCode,
          periodFrom: settlementRow.periodFrom,
          periodTo: settlementRow.periodTo,
          grossAmount: Number(settlementRow.grossAmount),
          netAmount: Number(settlementRow.netAmount),
          platformFee: Number(settlementRow.platformFee),
          orderCount: settlementRow.orderCount,
          status: settlementRow.status,
          paidAt: settlementRow.paidAt,
        }),
        ...this.pagedResponse([], 0, p, l),
      };
    }

    const where: Prisma.OrderWhereInput = {
      merchantId,
      status: 'DELIVERED',
      id: { in: orderIds },
    };

    const [sharePercent, paidOrderIds, orderRows, total] = await Promise.all([
      this.platformSettings.getMerchantFoodSharePercentForMerchant(merchantId),
      this.settlements.getPaidOrderIds('MERCHANT', merchantId),
      this.prisma.order.findMany({
        where,
        select: earningsSelect,
        orderBy: { createdAt: 'desc' },
        skip,
        take: l,
      }),
      this.prisma.order.count({ where }),
    ]);

    const items = this.buildMerchantOrderEarningsList(
      orderRows,
      sharePercent,
      paidOrderIds,
      { forAdmin: true, includePlatformFee: false },
    ).filter((order) => order.payoutStatus === 'PAID');

    return {
      settlement: this.mapMerchantSettlementView({
        id: settlementRow.id,
        referenceCode: settlementRow.referenceCode,
        periodFrom: settlementRow.periodFrom,
        periodTo: settlementRow.periodTo,
        grossAmount: Number(settlementRow.grossAmount),
        netAmount: Number(settlementRow.netAmount),
        platformFee: Number(settlementRow.platformFee),
        orderCount: settlementRow.orderCount,
        status: settlementRow.status,
        paidAt: settlementRow.paidAt,
      }),
      ...this.pagedResponse(items, total, p, l),
    };
  }

  async listPaidOrdersForMerchant(
    merchantId: string,
    query: MerchantEarningsQueryDto,
  ) {
    const { from, to } = this.resolveMerchantEarningsPeriod(query);
    const { page: p, limit: l, skip } = this.normalizePagination(
      query.page ?? 1,
      query.limit ?? 20,
    );

    const earningsSelect = {
      id: true,
      checkoutRef: true,
      createdAt: true,
      itemsSnapshot: true,
      subtotal: true,
    } satisfies Prisma.OrderSelect;

    const [sharePercent, paidOrderIds] = await Promise.all([
      this.platformSettings.getMerchantFoodSharePercentForMerchant(merchantId),
      this.settlements.getPaidOrderIds('MERCHANT', merchantId),
    ]);

    const paidIds = [...paidOrderIds];
    if (paidIds.length === 0) {
      return {
        period: {
          from: from.toISOString(),
          to: to.toISOString(),
        },
        ...this.pagedResponse([], 0, p, l),
      };
    }

    const where: Prisma.OrderWhereInput = {
      merchantId,
      status: 'DELIVERED',
      id: { in: paidIds },
      createdAt: { gte: from, lte: to },
    };

    const [orderRows, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        select: earningsSelect,
        orderBy: { createdAt: 'desc' },
        skip,
        take: l,
      }),
      this.prisma.order.count({ where }),
    ]);

    const items = this.buildMerchantOrderEarningsList(
      orderRows,
      sharePercent,
      paidOrderIds,
      { forAdmin: true, includePlatformFee: false },
    ).filter((order) => order.payoutStatus === 'PAID');

    return {
      period: {
        from: from.toISOString(),
        to: to.toISOString(),
      },
      ...this.pagedResponse(items, total, p, l),
    };
  }

  async markMerchantEarningsPaid(
    merchantId: string,
    query: MerchantEarningsQueryDto,
  ) {
    const { from, to } = this.resolveMerchantEarningsPeriod(query);
    const sharePercent =
      await this.platformSettings.getMerchantFoodSharePercentForMerchant(
        merchantId,
      );
    const settlement = await this.settlements.markMerchantEarningsPaid(
      merchantId,
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
}
