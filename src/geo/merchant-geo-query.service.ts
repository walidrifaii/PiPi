import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash } from 'node:crypto';
import { AppRedisService } from '../common/app-redis.service';
import { PrismaService } from '../prisma/prisma.service';

const SERVICE_AREA_CACHE_TTL_SEC = readInt('GEO_SERVICE_AREA_CACHE_TTL_SEC', 300);
const MERCHANT_LIST_CACHE_TTL_SEC = readInt('GEO_MERCHANT_LIST_CACHE_TTL_SEC', 30);

export type MerchantGeoPageParams = {
  cityCode: string;
  userLat: number;
  userLng: number;
  merchantTypeCode?: string;
  radiusKm?: number;
  page: number;
  limit: number;
  skip: number;
};

export type MerchantGeoPageResult = {
  ids: string[];
  distanceKmById: Map<string, number>;
  total: number;
};

function readInt(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) {
    return fallback;
  }
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

function geoPointCacheKey(lat: number, lng: number): string {
  return `${lat.toFixed(4)}:${lng.toFixed(4)}`;
}

function merchantListCacheKey(params: MerchantGeoPageParams): string {
  const payload = {
    cityCode: params.cityCode,
    userLat: params.userLat.toFixed(5),
    userLng: params.userLng.toFixed(5),
    merchantTypeCode: params.merchantTypeCode ?? '',
    radiusKm: params.radiusKm ?? '',
    page: params.page,
    limit: params.limit,
  };
  const hash = createHash('sha256')
    .update(JSON.stringify(payload))
    .digest('hex')
    .slice(0, 20);
  return `geo:merchants:${hash}`;
}

@Injectable()
export class MerchantGeoQueryService {
  private readonly log = new Logger(MerchantGeoQueryService.name);
  private geoSqlReady: boolean | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: AppRedisService,
  ) {}

  /** True when pure-SQL geo functions from migration are installed. */
  async isGeoSqlReady(): Promise<boolean> {
    if (this.geoSqlReady !== null) {
      return this.geoSqlReady;
    }
    try {
      const rows = await this.prisma.$queryRaw<{ ready: boolean }[]>`
        SELECT EXISTS (
          SELECT 1
          FROM pg_proc
          WHERE proname = 'haversine_km'
        ) AS ready
      `;
      this.geoSqlReady = rows[0]?.ready ?? false;
    } catch (err) {
      this.log.warn(`Geo SQL unavailable; legacy path used (${String(err)})`);
      this.geoSqlReady = false;
    }
    return this.geoSqlReady;
  }

  /** @deprecated Use isGeoSqlReady */
  async isPostgisReady(): Promise<boolean> {
    return this.isGeoSqlReady();
  }

  /** Smallest active polygon containing (lng, lat), cached ~5 min. */
  async resolveServiceAreaCodeForPoint(
    lng: number,
    lat: number,
  ): Promise<string | null> {
    if (!(await this.isGeoSqlReady())) {
      return null;
    }

    const cacheKey = `geo:sa:code:${geoPointCacheKey(lat, lng)}`;
    const cached = await this.redis.getJson<{ code: string | null }>(cacheKey);
    if (cached !== null && 'code' in cached) {
      return cached.code;
    }

    const rows = await this.prisma.$queryRaw<{ code: string }[]>`
      SELECT sa.code
      FROM service_areas sa
      WHERE sa.is_active = true
        AND sa.boundary_geo_json IS NOT NULL
        AND point_in_geojson_polygon(
          ${lng},
          ${lat},
          sa.boundary_geo_json
        )
      ORDER BY geojson_exterior_area_sq(sa.boundary_geo_json) ASC, sa.code ASC
      LIMIT 1
    `;
    const code = rows[0]?.code ?? null;
    if (code) {
      await this.redis.setJson(cacheKey, { code }, SERVICE_AREA_CACHE_TTL_SEC);
    } else {
      await this.redis.setJson(cacheKey, { code: null }, 60);
    }
    return code;
  }

  async isPointInActiveServiceArea(
    code: string,
    lng: number,
    lat: number,
  ): Promise<boolean> {
    if (!(await this.isGeoSqlReady())) {
      return false;
    }

    const normalized = code.trim().toUpperCase();
    const cacheKey = `geo:sa:in:${normalized}:${geoPointCacheKey(lat, lng)}`;
    const cached = await this.redis.getJson<{ ok: boolean }>(cacheKey);
    if (cached !== null && typeof cached.ok === 'boolean') {
      return cached.ok;
    }

    const rows = await this.prisma.$queryRaw<{ ok: boolean }[]>`
      SELECT EXISTS (
        SELECT 1
        FROM service_areas sa
        WHERE sa.code = ${normalized}
          AND sa.is_active = true
          AND sa.boundary_geo_json IS NOT NULL
          AND point_in_geojson_polygon(
            ${lng},
            ${lat},
            sa.boundary_geo_json
          )
      ) AS ok
    `;
    const ok = rows[0]?.ok ?? false;
    await this.redis.setJson(cacheKey, { ok }, SERVICE_AREA_CACHE_TTL_SEC);
    return ok;
  }

  async listMerchantIdsInServiceArea(cityCode: string): Promise<string[]> {
    if (!(await this.isGeoSqlReady())) {
      return [];
    }

    const normalized = cityCode.trim().toUpperCase();
    const rows = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT m.id
      FROM merchants m
      INNER JOIN service_areas sa
        ON sa.code = m.city_code
        AND sa.is_active = true
        AND sa.boundary_geo_json IS NOT NULL
      WHERE m.city_code = ${normalized}
        AND m.latitude IS NOT NULL
        AND m.longitude IS NOT NULL
        AND point_in_geojson_polygon(
          m.longitude::double precision,
          m.latitude::double precision,
          sa.boundary_geo_json
        )
    `;
    return rows.map((r) => r.id);
  }

  async getMerchantsNearPointPage(
    params: MerchantGeoPageParams,
  ): Promise<MerchantGeoPageResult | null> {
    if (!(await this.isGeoSqlReady())) {
      return null;
    }

    const cacheKey = merchantListCacheKey(params);
    const cached = await this.redis.getJson<{
      ids: string[];
      distances: Array<[string, number]>;
      total: number;
    }>(cacheKey);
    if (cached) {
      return {
        ids: cached.ids,
        distanceKmById: new Map(cached.distances),
        total: cached.total,
      };
    }

    const cityCode = params.cityCode.trim().toUpperCase();
    const distanceExpr = Prisma.sql`haversine_km(
      ${params.userLat},
      ${params.userLng},
      m.latitude::double precision,
      m.longitude::double precision
    )`;

    const merchantTypeFilter = params.merchantTypeCode
      ? Prisma.sql`AND mt.code = ${params.merchantTypeCode.trim().toUpperCase()}`
      : Prisma.empty;

    const radiusFilter =
      params.radiusKm !== undefined
        ? Prisma.sql`AND ${distanceExpr} <= ${params.radiusKm}`
        : Prisma.empty;

    const baseFrom = Prisma.sql`
      FROM merchants m
      INNER JOIN merchant_types mt ON mt.id = m.merchant_type_id
      INNER JOIN service_areas sa
        ON sa.code = m.city_code
        AND sa.is_active = true
        AND sa.boundary_geo_json IS NOT NULL
      WHERE m.city_code = ${cityCode}
        AND m.latitude IS NOT NULL
        AND m.longitude IS NOT NULL
        AND point_in_geojson_polygon(
          m.longitude::double precision,
          m.latitude::double precision,
          sa.boundary_geo_json
        )
        ${merchantTypeFilter}
        ${radiusFilter}
    `;

    const countRows = await this.prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*)::bigint AS count
      ${baseFrom}
    `;
    const total = Number(countRows[0]?.count ?? 0);
    if (total === 0) {
      const empty: MerchantGeoPageResult = {
        ids: [],
        distanceKmById: new Map(),
        total: 0,
      };
      await this.redis.setJson(
        cacheKey,
        { ids: [], distances: [], total: 0 },
        MERCHANT_LIST_CACHE_TTL_SEC,
      );
      return empty;
    }

    const pageRows = await this.prisma.$queryRaw<
      { id: string; distance_km: number }[]
    >`
      SELECT
        m.id,
        ${distanceExpr}::float8 AS distance_km
      ${baseFrom}
      ORDER BY distance_km ASC, m.created_at DESC
      LIMIT ${params.limit}
      OFFSET ${params.skip}
    `;

    const ids = pageRows.map((r) => r.id);
    const distanceKmById = new Map(
      pageRows.map((r) => [r.id, Number(r.distance_km)]),
    );

    await this.redis.setJson(
      cacheKey,
      {
        ids,
        distances: [...distanceKmById.entries()],
        total,
      },
      MERCHANT_LIST_CACHE_TTL_SEC,
    );

    return { ids, distanceKmById, total };
  }
}
