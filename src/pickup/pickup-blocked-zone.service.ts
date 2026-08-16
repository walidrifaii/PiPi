import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  parsePolygonRingsFromGeoJson,
  pointInPolygonRings,
  pointOutsideExteriorBBox,
  exteriorRingBoundingBox,
} from '../common/geojson-polygon';
import { PrismaService } from '../prisma/prisma.service';
import {
  appliesToMatchesRole,
  type PickupLocationRole,
} from './pickup.constants';
import {
  CreatePickupBlockedZoneDto,
  UpdatePickupBlockedZoneDto,
} from './dto/pickup-blocked-zone.dto';

export type PickupCoverageResult = {
  allowed: boolean;
  role: PickupLocationRole;
  reason: string | null;
  zoneId: string | null;
  zoneName: string | null;
};

export type PickupBlockedZoneView = {
  id: string;
  name: string;
  appliesTo: string;
  boundaryGeoJson: unknown;
  isActive: boolean;
  reason: string | null;
  createdAt: string;
  updatedAt: string;
};

@Injectable()
export class PickupBlockedZoneService {
  private readonly log = new Logger(PickupBlockedZoneService.name);

  constructor(private readonly prisma: PrismaService) {}

  private mapRow(row: {
    id: string;
    name: string;
    appliesTo: string;
    boundaryGeoJson: unknown;
    isActive: boolean;
    reason: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): PickupBlockedZoneView {
    return {
      id: row.id,
      name: row.name,
      appliesTo: row.appliesTo,
      boundaryGeoJson: row.boundaryGeoJson,
      isActive: row.isActive,
      reason: row.reason,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private assertValidPolygon(raw: unknown) {
    const parsed = parsePolygonRingsFromGeoJson(raw);
    if (!parsed) {
      throw new BadRequestException(
        'boundaryGeoJson must be a valid GeoJSON Polygon (or Feature / FeatureCollection wrapping one)',
      );
    }
    return parsed;
  }

  async findAllAdmin(): Promise<PickupBlockedZoneView[]> {
    const rows = await this.prisma.pickupBlockedZone.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((row) => this.mapRow(row));
  }

  async createAdmin(
    dto: CreatePickupBlockedZoneDto,
  ): Promise<PickupBlockedZoneView> {
    this.assertValidPolygon(dto.boundaryGeoJson);
    const row = await this.prisma.pickupBlockedZone.create({
      data: {
        name: dto.name.trim(),
        appliesTo: dto.appliesTo,
        boundaryGeoJson: dto.boundaryGeoJson as Prisma.InputJsonValue,
        reason: dto.reason?.trim() || null,
        isActive: dto.isActive ?? true,
      },
    });
    return this.mapRow(row);
  }

  async updateAdmin(
    id: string,
    dto: UpdatePickupBlockedZoneDto,
  ): Promise<PickupBlockedZoneView> {
    const existing = await this.prisma.pickupBlockedZone.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException('Pickup blocked zone not found');
    }
    if (dto.boundaryGeoJson !== undefined) {
      this.assertValidPolygon(dto.boundaryGeoJson);
    }
    const row = await this.prisma.pickupBlockedZone.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.appliesTo !== undefined ? { appliesTo: dto.appliesTo } : {}),
        ...(dto.boundaryGeoJson !== undefined
          ? {
              boundaryGeoJson: dto.boundaryGeoJson as Prisma.InputJsonValue,
            }
          : {}),
        ...(dto.reason !== undefined
          ? { reason: dto.reason?.trim() || null }
          : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
    return this.mapRow(row);
  }

  async deleteAdmin(id: string): Promise<{ deleted: true; id: string }> {
    const existing = await this.prisma.pickupBlockedZone.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException('Pickup blocked zone not found');
    }
    await this.prisma.pickupBlockedZone.delete({ where: { id } });
    return { deleted: true, id };
  }

  async checkPoint(
    lat: number,
    lng: number,
    role: PickupLocationRole,
  ): Promise<PickupCoverageResult> {
    const rows = await this.prisma.pickupBlockedZone.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        appliesTo: true,
        reason: true,
        boundaryGeoJson: true,
      },
    });

    for (const row of rows) {
      if (!appliesToMatchesRole(row.appliesTo, role)) {
        continue;
      }
      const parsed = parsePolygonRingsFromGeoJson(row.boundaryGeoJson);
      if (!parsed) {
        this.log.warn(`Invalid GeoJSON on pickup blocked zone ${row.id}`);
        continue;
      }
      const bbox = exteriorRingBoundingBox(parsed.exterior);
      if (bbox !== null && pointOutsideExteriorBBox(lng, lat, bbox)) {
        continue;
      }
      if (pointInPolygonRings(lng, lat, parsed)) {
        const fallback =
          role === 'from'
            ? 'Pickup is not available from this location'
            : 'We cannot deliver to this location';
        return {
          allowed: false,
          role,
          reason: row.reason?.trim() || fallback,
          zoneId: row.id,
          zoneName: row.name,
        };
      }
    }

    return {
      allowed: true,
      role,
      reason: null,
      zoneId: null,
      zoneName: null,
    };
  }

  async assertPointAllowed(
    lat: number,
    lng: number,
    role: PickupLocationRole,
  ): Promise<void> {
    const result = await this.checkPoint(lat, lng, role);
    if (!result.allowed) {
      throw new BadRequestException(
        result.reason ??
          (role === 'from'
            ? 'Pickup is not available from this location'
            : 'We cannot deliver to this location'),
      );
    }
  }

  async assertRouteAllowed(from: { lat: number; lng: number }, to: { lat: number; lng: number }) {
    await this.assertPointAllowed(from.lat, from.lng, 'from');
    await this.assertPointAllowed(to.lat, to.lng, 'to');
  }
}
