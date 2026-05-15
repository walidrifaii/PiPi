import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  exteriorRingAreaSqDegrees,
  exteriorRingBoundingBox,
  parsePolygonRingsFromGeoJson,
  pointInPolygonRings,
  pointOutsideExteriorBBox,
  type PolygonRings,
} from '../common/geojson-polygon';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ServiceAreaService {
  private readonly log = new Logger(ServiceAreaService.name);

  constructor(private readonly prisma: PrismaService) {}

  private normalizeCode(code: string): string {
    return code.trim().toUpperCase();
  }

  /**
   * Returns parsed polygon rings when an active service area has valid boundary GeoJSON.
   */
  async getPolygonRingsForActiveCode(
    code: string,
  ): Promise<PolygonRings | null> {
    const normalized = this.normalizeCode(code);
    const row = await this.prisma.serviceArea.findFirst({
      where: { code: normalized, isActive: true },
      select: { boundaryGeoJson: true },
    });
    if (!row) {
      return null;
    }
    if (row.boundaryGeoJson === null || row.boundaryGeoJson === undefined) {
      return null;
    }
    const parsed = parsePolygonRingsFromGeoJson(row.boundaryGeoJson);
    if (!parsed) {
      this.log.warn(`Invalid or unsupported boundary GeoJSON for code=${code}`);
    }
    return parsed;
  }

  /**
   * Among active areas whose polygon contains (lng, lat), selects the **smallest** exterior
   * (most specific zone), then ties on `code` ascending. Parses fresh GeoJSON each time so
   * DB updates apply without stale process cache.
   */
  async findActiveAreaContainingPoint(
    lng: number,
    lat: number,
  ): Promise<{ code: string; polygon: PolygonRings } | null> {
    const rows = await this.prisma.serviceArea.findMany({
      where: { isActive: true, boundaryGeoJson: { not: Prisma.JsonNull } },
      orderBy: { code: 'asc' },
      select: { code: true, boundaryGeoJson: true },
    });
    type Hit = { code: string; polygon: PolygonRings; areaSq: number };
    const hits: Hit[] = [];
    for (const row of rows) {
      const parsed = parsePolygonRingsFromGeoJson(row.boundaryGeoJson);
      if (!parsed) {
        this.log.warn(
          `Invalid or unsupported boundary GeoJSON for code=${row.code}`,
        );
        continue;
      }
      /* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call */
      const bbox = exteriorRingBoundingBox(parsed.exterior);
      if (bbox !== null && pointOutsideExteriorBBox(lng, lat, bbox)) {
        continue;
      }
      if (!pointInPolygonRings(lng, lat, parsed)) {
        continue;
      }
      const areaSq = exteriorRingAreaSqDegrees(parsed.exterior);
      hits.push({ code: row.code, polygon: parsed, areaSq });
      /* eslint-enable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call */
    }
    if (hits.length === 0) {
      return null;
    }
    hits.sort((a, b) => {
      if (a.areaSq !== b.areaSq) {
        return a.areaSq - b.areaSq;
      }
      return a.code.localeCompare(b.code);
    });
    const best = hits[0];
    return { code: best.code, polygon: best.polygon };
  }

  findAllAdmin() {
    return this.prisma.serviceArea.findMany({
      orderBy: { code: 'asc' },
      select: {
        id: true,
        code: true,
        name: true,
        isActive: true,
        boundaryGeoJson: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async upsertByCode(
    code: string,
    dto: {
      name?: string;
      boundaryGeoJson?: Record<string, unknown> | null;
      isActive?: boolean;
    },
  ) {
    const normalized = code.trim().toUpperCase();
    if (!normalized) {
      throw new BadRequestException('code is required');
    }

    const dataUpdate: Prisma.ServiceAreaUpdateInput = {};
    if (dto.name !== undefined) {
      dataUpdate.name = dto.name;
    }
    if (dto.boundaryGeoJson !== undefined) {
      dataUpdate.boundaryGeoJson =
        dto.boundaryGeoJson === null
          ? Prisma.JsonNull
          : (dto.boundaryGeoJson as Prisma.InputJsonValue);
    }
    if (dto.isActive !== undefined) {
      dataUpdate.isActive = dto.isActive;
    }

    return this.prisma.serviceArea.upsert({
      where: { code: normalized },
      create: {
        code: normalized,
        name: dto.name ?? null,
        boundaryGeoJson:
          dto.boundaryGeoJson === undefined
            ? Prisma.JsonNull
            : dto.boundaryGeoJson === null
              ? Prisma.JsonNull
              : (dto.boundaryGeoJson as Prisma.InputJsonValue),
        isActive: dto.isActive ?? true,
      },
      update: dataUpdate,
      select: {
        id: true,
        code: true,
        name: true,
        isActive: true,
        boundaryGeoJson: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }
}
