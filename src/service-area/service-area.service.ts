import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  parsePolygonRingsFromGeoJson,
  type PolygonRings,
} from '../common/geojson-polygon';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ServiceAreaService {
  private readonly log = new Logger(ServiceAreaService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Returns parsed polygon rings when an active service area has valid boundary GeoJSON.
   */
  async getPolygonRingsForActiveCode(
    code: string,
  ): Promise<PolygonRings | null> {
    const row = await this.prisma.serviceArea.findFirst({
      where: { code, isActive: true },
      select: { boundaryGeoJson: true },
    });
    if (row?.boundaryGeoJson === null || row?.boundaryGeoJson === undefined) {
      return null;
    }
    const parsed = parsePolygonRingsFromGeoJson(row.boundaryGeoJson);
    if (!parsed) {
      this.log.warn(`Invalid or unsupported boundary GeoJSON for code=${code}`);
    }
    return parsed;
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
