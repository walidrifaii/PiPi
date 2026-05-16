import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { haversineDistanceKm } from './common/haversine';
import {
  exteriorRingBoundingBox,
  pointInPolygonRings,
  pointOutsideExteriorBBox,
  type PolygonRings,
} from './common/geojson-polygon';
import { hashPassword } from './common/hash-password';
import {
  buildFullWeekSchedule,
  coerceWeekFromPartialDays,
  computeMerchantOpenNow,
  parseIsoWeekdayFromInput,
  validateWorkingHoursForEnabled,
  workingIntervalsToWeek,
  type MerchantWorkingHoursDay,
  type MerchantWorkingHoursWeek,
  type WorkingDayScheduleEntry,
} from './common/merchant-open-status';
import { MerchantStoreStatus } from './merchant/dto/set-merchant-store-status.dto';
import { UpsertMerchantWorkingHoursDto } from './merchant/dto/upsert-merchant-working-hours.dto';
import { UpdateMerchantDto } from './merchant/dto/update-merchant.dto';
import { PrismaService } from './prisma/prisma.service';
import { ServiceAreaService } from './service-area/service-area.service';

export type MerchantListItem = {
  id: string;
  name: string;
  merchantTypeId: string;
  merchantType: string;
  logoUrl: string | null;
  coverImageUrl: string | null;
  cityCode: string | null;
  latitude: number | null;
  longitude: number | null;
  /** Manual OPEN/CLOSED from PATCH /merchants/me/status (stored as is_active). */
  isActive: boolean;
  /** True when the store accepts customers now (manual OPEN and inside working hours if enabled). */
  isOpenNow: boolean;
  /** Customer-visible OPEN/CLOSED (same as isOpenNow). */
  status: MerchantStoreStatus;
  useWorkingHours: boolean;
  timezone: string | null;
  /** Monday–Sunday with English `weekday` and `intervals` (`h:mm AM/PM`, empty = closed); null if `useWorkingHours` is false. */
  workingHoursSchedule: WorkingDayScheduleEntry[] | null;
  createdAt: Date;
  updatedAt: Date;
  /** Set when listing with lat and lng (near me). */
  distanceKm?: number | null;
};

/** Response for GET /merchants/me/working-hours (merchant app edit screen). */
export type MerchantWorkingHoursResponse = {
  useWorkingHours: boolean;
  timezone: string | null;
  /** Mon–Sun with English `weekday` and `h:mm AM/PM` intervals; null when `useWorkingHours` is false. */
  workingHoursSchedule: WorkingDayScheduleEntry[] | null;
};

export type GetMerchantsQuery = {
  merchantTypeCode?: string;
  cityCode?: string;
  lat?: string;
  lng?: string;
  radiusKm?: string;
  page?: number;
  limit?: number;
};

export type PagedMerchantsResponse = {
  items: MerchantListItem[];
  pagination: {
    page: number;
    limit: number;
    pageTotal: number;
    total: number;
    totalPages: number;
  };
};

type MerchantRowForList = {
  id: string;
  name: string;
  merchantTypeId: string;
  imageUrl: string | null;
  coverImageUrl: string | null;
  isActive: boolean;
  useWorkingHours: boolean;
  timezone: string | null;
  workingIntervals: Array<{
    weekday: number;
    openLocal: string;
    closeLocal: string;
    sortOrder: number;
  }>;
  createdAt: Date;
  updatedAt: Date;
  cityCode: string | null;
  latitude: unknown;
  longitude: unknown;
  merchantType: { code: string };
};

@Injectable()
export class MerchantIntegrationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly serviceArea: ServiceAreaService,
  ) {}

  private get db(): PrismaClient {
    return this.prisma as unknown as PrismaClient;
  }

  private decimalToNumber(value: unknown): number | null {
    if (value === null || value === undefined) {
      return null;
    }
    const n = Number(value as string);
    return Number.isFinite(n) ? n : null;
  }

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

  private pagedResponse(
    items: MerchantListItem[],
    total: number,
    page: number,
    limit: number,
  ): PagedMerchantsResponse {
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

  private rowToListItem(
    r: MerchantRowForList,
    distanceKm?: number | null,
  ): MerchantListItem {
    const week = workingIntervalsToWeek(r.workingIntervals);
    const weekOrNull = week.days.length > 0 ? week : null;
    const isOpenNow = computeMerchantOpenNow({
      isActive: r.isActive,
      useWorkingHours: r.useWorkingHours,
      timezone: r.timezone,
      week: weekOrNull,
    });
    return {
      id: r.id,
      name: r.name,
      merchantTypeId: r.merchantTypeId,
      merchantType: r.merchantType.code,
      logoUrl: r.imageUrl,
      coverImageUrl: r.coverImageUrl,
      cityCode: r.cityCode,
      latitude: this.decimalToNumber(r.latitude),
      longitude: this.decimalToNumber(r.longitude),
      isActive: r.isActive,
      isOpenNow,
      status: isOpenNow ? MerchantStoreStatus.OPEN : MerchantStoreStatus.CLOSED,
      useWorkingHours: r.useWorkingHours,
      timezone: r.timezone,
      workingHoursSchedule: r.useWorkingHours
        ? buildFullWeekSchedule(weekOrNull)
        : null,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      ...(distanceKm !== undefined ? { distanceKm } : {}),
    };
  }

  private listSelect = {
    id: true,
    name: true,
    merchantTypeId: true,
    imageUrl: true,
    coverImageUrl: true,
    isActive: true,
    useWorkingHours: true,
    timezone: true,
    workingIntervals: {
      orderBy: [
        { weekday: Prisma.SortOrder.asc },
        { sortOrder: Prisma.SortOrder.asc },
      ],
      select: {
        weekday: true,
        openLocal: true,
        closeLocal: true,
        sortOrder: true,
      },
    },
    createdAt: true,
    updatedAt: true,
    cityCode: true,
    latitude: true,
    longitude: true,
    merchantType: { select: { code: true } },
  };

  private workingHoursSelect = {
    useWorkingHours: true,
    timezone: true,
    workingIntervals: {
      orderBy: [
        { weekday: Prisma.SortOrder.asc },
        { sortOrder: Prisma.SortOrder.asc },
      ],
      select: {
        weekday: true,
        openLocal: true,
        closeLocal: true,
        sortOrder: true,
      },
    },
  };

  async getMerchantWorkingHours(
    merchantId: string,
  ): Promise<MerchantWorkingHoursResponse> {
    const row = await this.db.merchant.findUniqueOrThrow({
      where: { id: merchantId },
      select: this.workingHoursSelect,
    });
    const week = workingIntervalsToWeek(row.workingIntervals);
    const weekOrNull = week.days.length > 0 ? week : null;
    return {
      useWorkingHours: row.useWorkingHours,
      timezone: row.timezone,
      workingHoursSchedule: row.useWorkingHours
        ? buildFullWeekSchedule(weekOrNull)
        : null,
    };
  }

  async getMerchants(
    q: GetMerchantsQuery = {},
  ): Promise<PagedMerchantsResponse> {
    const pg = this.normalizePagination(q.page ?? 1, q.limit ?? 20);
    const merchantTypeCode = q.merchantTypeCode;
    const cityRaw = q.cityCode;
    const latRaw = q.lat;
    const lngRaw = q.lng;
    const radiusRaw = q.radiusKm;

    if (merchantTypeCode) {
      const code = merchantTypeCode.trim().toUpperCase();
      const exists = await this.db.merchantType.findUnique({
        where: { code },
        select: { id: true },
      });
      if (!exists) {
        throw new BadRequestException('Invalid merchantType filter');
      }
    }

    const latStr = latRaw?.trim() ?? '';
    const lngStr = lngRaw?.trim() ?? '';
    const hasLat = latStr.length > 0;
    const hasLng = lngStr.length > 0;
    if (hasLat !== hasLng) {
      throw new BadRequestException(
        'lat and lng must both be provided together',
      );
    }

    let userLat: number | undefined;
    let userLng: number | undefined;
    if (hasLat && hasLng) {
      userLat = Number(latStr);
      userLng = Number(lngStr);
      if (!Number.isFinite(userLat) || !Number.isFinite(userLng)) {
        throw new BadRequestException('lat and lng must be valid numbers');
      }
      if (userLat < -90 || userLat > 90 || userLng < -180 || userLng > 180) {
        throw new BadRequestException('lat or lng out of valid range');
      }
    }

    let radiusKm: number | undefined;
    const radiusStr = radiusRaw?.trim() ?? '';
    if (radiusStr.length > 0) {
      radiusKm = Number(radiusStr);
      if (!Number.isFinite(radiusKm) || radiusKm <= 0 || radiusKm > 500) {
        throw new BadRequestException(
          'radiusKm must be a number greater than 0 and at most 500',
        );
      }
    }

    if (radiusKm !== undefined && !hasLat) {
      throw new BadRequestException('radiusKm requires lat and lng');
    }

    const normalizedCity =
      cityRaw && cityRaw.trim().length > 0
        ? cityRaw.trim().toUpperCase()
        : undefined;

    let effectiveCity = normalizedCity;
    /** When set, both user (already checked) and each merchant GPS must lie inside here. */
    let serviceBoundaryPoly: PolygonRings | undefined;

    if (
      !normalizedCity &&
      hasLat &&
      userLat !== undefined &&
      userLng !== undefined
    ) {
      const resolved = await this.serviceArea.findActiveAreaContainingPoint(
        userLng,
        userLat,
      );
      if (!resolved) {
        return this.pagedResponse([], 0, pg.page, pg.limit);
      }
      effectiveCity = resolved.code;
      serviceBoundaryPoly = resolved.polygon;
    } else if (
      normalizedCity &&
      hasLat &&
      userLat !== undefined &&
      userLng !== undefined
    ) {
      const poly =
        await this.serviceArea.getPolygonRingsForActiveCode(normalizedCity);
      if (poly) {
        if (!pointInPolygonRings(userLng, userLat, poly)) {
          return this.pagedResponse([], 0, pg.page, pg.limit);
        }
        serviceBoundaryPoly = poly;
      }
    }

    const where: Prisma.MerchantWhereInput = {};
    if (merchantTypeCode) {
      where.merchantType = {
        code: merchantTypeCode.trim().toUpperCase(),
      };
    }
    if (effectiveCity) {
      where.cityCode = effectiveCity;
    }

    let rows = await this.db.merchant.findMany({
      where,
      orderBy: hasLat ? undefined : { createdAt: 'desc' },
      select: this.listSelect,
    });

    if (serviceBoundaryPoly !== undefined && hasLat) {
      const boundary = serviceBoundaryPoly;

      const bbox = exteriorRingBoundingBox(boundary.exterior);
      const kept: typeof rows = [];
      for (const r of rows) {
        const row = r as MerchantRowForList;
        const mLat = this.decimalToNumber(row.latitude);
        const mLng = this.decimalToNumber(row.longitude);
        if (mLat === null || mLng === null) {
          continue;
        }
        if (bbox !== null && pointOutsideExteriorBBox(mLng, mLat, bbox)) {
          continue;
        }
        if (!pointInPolygonRings(mLng, mLat, boundary)) {
          continue;
        }
        kept.push(r);
      }

      rows = kept;
    }

    let items: MerchantListItem[];

    if (!hasLat || userLat === undefined || userLng === undefined) {
      items = rows.map((r) =>
        this.rowToListItem(r as unknown as MerchantRowForList),
      );
    } else {
      type WithDist = { row: MerchantRowForList; distanceKm: number | null };
      let withDist: WithDist[] = rows.map((r) => {
        const row = r as MerchantRowForList;
        const lat = this.decimalToNumber(row.latitude);
        const lng = this.decimalToNumber(row.longitude);
        if (lat === null || lng === null) {
          return { row, distanceKm: null };
        }
        return {
          row,
          distanceKm: haversineDistanceKm(userLat, userLng, lat, lng),
        };
      });

      if (radiusKm !== undefined) {
        withDist = withDist.filter(
          (x) => x.distanceKm !== null && x.distanceKm <= radiusKm,
        );
      }

      withDist.sort((a, b) => {
        if (a.distanceKm === null && b.distanceKm === null) {
          return b.row.createdAt.getTime() - a.row.createdAt.getTime();
        }
        if (a.distanceKm === null) {
          return 1;
        }
        if (b.distanceKm === null) {
          return -1;
        }
        if (a.distanceKm !== b.distanceKm) {
          return a.distanceKm - b.distanceKm;
        }
        return b.row.createdAt.getTime() - a.row.createdAt.getTime();
      });

      items = withDist.map((x) =>
        this.rowToListItem(
          x.row as unknown as MerchantRowForList,
          x.distanceKm,
        ),
      );
    }

    const total = items.length;
    const pageItems = items.slice(pg.skip, pg.skip + pg.limit);
    return this.pagedResponse(pageItems, total, pg.page, pg.limit);
  }

  private async assertUniqueMerchantCredentials(
    email: string | undefined | null,
    phone: string | undefined | null,
    excludeMerchantId?: string,
  ): Promise<void> {
    const orClause: Array<{ email: string } | { phone: string }> = [];
    if (email) {
      orClause.push({ email });
    }
    if (phone) {
      orClause.push({ phone });
    }
    if (orClause.length === 0) {
      return;
    }
    const conflict = await this.db.merchant.findFirst({
      where: {
        ...(excludeMerchantId ? { id: { not: excludeMerchantId } } : {}),
        OR: orClause,
      },
      select: { id: true },
    });
    if (conflict) {
      throw new ConflictException(
        'Another merchant already uses this email or phone',
      );
    }
  }

  async updateMerchant(
    merchantId: string,
    dto: UpdateMerchantDto,
  ): Promise<MerchantListItem> {
    const current = await this.db.merchant.findUnique({
      where: { id: merchantId },
      select: { email: true, phone: true },
    });

    const nextEmail = dto.email !== undefined ? dto.email : current?.email;
    const nextPhone = dto.phone !== undefined ? dto.phone : current?.phone;

    if (
      typeof dto.password === 'string' &&
      dto.password.length > 0 &&
      (!nextEmail || !nextPhone)
    ) {
      throw new BadRequestException(
        'Merchant must have both email and phone before a password can be set',
      );
    }

    if (dto.email !== undefined || dto.phone !== undefined) {
      await this.assertUniqueMerchantCredentials(
        dto.email !== undefined ? dto.email : undefined,
        dto.phone !== undefined ? dto.phone : undefined,
        merchantId,
      );
    }

    let passwordHash: string | undefined;
    const newPassword = dto.password;
    if (typeof newPassword === 'string' && newPassword.length > 0) {
      passwordHash = await hashPassword(newPassword);
    }

    let cityCodeUpdate: string | null | undefined;
    if (Object.hasOwn(dto, 'cityCode')) {
      const raw = (dto as { cityCode?: unknown }).cityCode;
      if (raw === undefined) {
        cityCodeUpdate = undefined;
      } else if (typeof raw !== 'string') {
        throw new BadRequestException('cityCode must be a string');
      } else {
        cityCodeUpdate = raw.trim() === '' ? null : raw.trim().toUpperCase();
      }
    }

    let latitudeUpdate: number | undefined;
    if (Object.hasOwn(dto, 'latitude')) {
      const raw = (dto as { latitude?: unknown }).latitude;
      if (raw === undefined) {
        latitudeUpdate = undefined;
      } else if (typeof raw !== 'number' || !Number.isFinite(raw)) {
        throw new BadRequestException('latitude must be a finite number');
      } else if (raw < -90 || raw > 90) {
        throw new BadRequestException('latitude must be between -90 and 90');
      } else {
        latitudeUpdate = raw;
      }
    }

    let longitudeUpdate: number | undefined;
    if (Object.hasOwn(dto, 'longitude')) {
      const raw = (dto as { longitude?: unknown }).longitude;
      if (raw === undefined) {
        longitudeUpdate = undefined;
      } else if (typeof raw !== 'number' || !Number.isFinite(raw)) {
        throw new BadRequestException('longitude must be a finite number');
      } else if (raw < -180 || raw > 180) {
        throw new BadRequestException('longitude must be between -180 and 180');
      } else {
        longitudeUpdate = raw;
      }
    }

    const updated = await this.db.merchant.update({
      where: { id: merchantId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.merchantTypeId !== undefined
          ? { merchantTypeId: dto.merchantTypeId }
          : {}),
        ...(dto.logoUrl !== undefined ? { imageUrl: dto.logoUrl } : {}),
        ...(dto.coverImageUrl !== undefined
          ? { coverImageUrl: dto.coverImageUrl }
          : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        ...(dto.email !== undefined ? { email: dto.email } : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
        ...(passwordHash !== undefined ? { passwordHash } : {}),
        ...(cityCodeUpdate !== undefined ? { cityCode: cityCodeUpdate } : {}),
        ...(latitudeUpdate !== undefined ? { latitude: latitudeUpdate } : {}),
        ...(longitudeUpdate !== undefined
          ? { longitude: longitudeUpdate }
          : {}),
      },
      select: this.listSelect,
    });
    return this.rowToListItem(updated as unknown as MerchantRowForList);
  }

  async updateMerchantImage(
    merchantId: string,
    logoUrl: string,
  ): Promise<MerchantListItem> {
    const updated = await this.db.merchant.update({
      where: { id: merchantId },
      data: { imageUrl: logoUrl },
      select: this.listSelect,
    });
    return this.rowToListItem(updated as unknown as MerchantRowForList);
  }

  async setMerchantStoreStatus(
    merchantId: string,
    isActive: boolean,
  ): Promise<MerchantListItem> {
    const updated = await this.db.merchant.update({
      where: { id: merchantId },
      data: { isActive },
      select: this.listSelect,
    });
    return this.rowToListItem(updated as unknown as MerchantRowForList);
  }

  private buildWorkingIntervalCreates(
    merchantId: string,
    week: MerchantWorkingHoursWeek,
  ): Prisma.MerchantWorkingIntervalCreateManyInput[] {
    const out: Prisma.MerchantWorkingIntervalCreateManyInput[] = [];
    for (const day of week.days) {
      day.intervals.forEach((intv, idx) => {
        out.push({
          id: randomUUID(),
          merchantId,
          weekday: day.weekday,
          openLocal: intv.open,
          closeLocal: intv.close,
          sortOrder: idx,
        });
      });
    }
    return out;
  }

  async setMerchantWorkingHours(
    merchantId: string,
    dto: UpsertMerchantWorkingHoursDto,
  ): Promise<MerchantListItem> {
    if (!dto.useWorkingHours) {
      await this.db.$transaction(async (tx) => {
        await tx.merchantWorkingInterval.deleteMany({
          where: { merchantId },
        });
        await tx.merchant.update({
          where: { id: merchantId },
          data: { useWorkingHours: false },
        });
      });
      const updated = await this.db.merchant.findUniqueOrThrow({
        where: { id: merchantId },
        select: this.listSelect,
      });
      return this.rowToListItem(updated as unknown as MerchantRowForList);
    }
    if (dto.days == null) {
      throw new BadRequestException(
        'days is required when useWorkingHours is true',
      );
    }
    const internalDays: MerchantWorkingHoursDay[] = dto.days.map((d) => {
      const iso = parseIsoWeekdayFromInput(d.weekday);
      if (iso === null) {
        throw new BadRequestException(`Invalid weekday: ${String(d.weekday)}`);
      }
      return { weekday: iso, intervals: d.intervals };
    });
    const coerced = coerceWeekFromPartialDays(internalDays);
    const { timezone, week: normWeek } = validateWorkingHoursForEnabled(
      dto.timezone,
      coerced,
    );
    const intervalRows = this.buildWorkingIntervalCreates(merchantId, normWeek);
    await this.db.$transaction(async (tx) => {
      await tx.merchantWorkingInterval.deleteMany({
        where: { merchantId },
      });
      if (intervalRows.length > 0) {
        await tx.merchantWorkingInterval.createMany({ data: intervalRows });
      }
      await tx.merchant.update({
        where: { id: merchantId },
        data: {
          useWorkingHours: true,
          timezone,
        },
      });
    });
    const updated = await this.db.merchant.findUniqueOrThrow({
      where: { id: merchantId },
      select: this.listSelect,
    });
    return this.rowToListItem(updated as unknown as MerchantRowForList);
  }

  async deleteMerchant(merchantId: string): Promise<{ message: string }> {
    await this.db.merchant.delete({
      where: { id: merchantId },
    });
    return { message: 'Merchant deleted successfully' };
  }
}
