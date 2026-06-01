import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  computeDeliveryFeeBreakdown,
  DEFAULT_DELIVERY_FEE_FORMULA,
  type DeliveryFeeBreakdown,
  type DeliveryFeeFormula,
  deliveryFeeBetweenPoints,
} from '../common/delivery-fee';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDeliveryFeeConfigDto } from './dto/create-delivery-fee-config.dto';
import { QuoteDeliveryFeeQueryDto } from './dto/quote-delivery-fee-query.dto';
import { UpdateDeliveryFeeConfigDto } from './dto/update-delivery-fee-config.dto';

export type DeliveryFeeConfigItem = {
  id: string;
  name: string | null;
  fixedFee: number;
  kmUnit: number;
  feePerUnit: number;
  sampleBreakdown: DeliveryFeeBreakdown | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

@Injectable()
export class DeliveryFeeService {
  constructor(private readonly prisma: PrismaService) {}

  private toNumber(value: Prisma.Decimal | number | string): number {
    return Number(value);
  }

  private parseBreakdown(raw: unknown): DeliveryFeeBreakdown | null {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      return null;
    }
    const o = raw as Record<string, unknown>;
    if (typeof o.fixedFee !== 'number' || typeof o.deliveryFee !== 'number') {
      return null;
    }
    // New format
    if (typeof o.kmUnit === 'number' && typeof o.feePerUnit === 'number') {
      return o as DeliveryFeeBreakdown;
    }
    // Legacy rows (extra fields ignored)
    if (typeof o.feePerKm === 'number') {
      return {
        fixedFee: o.fixedFee,
        kmUnit: typeof o.kmUnit === 'number' ? o.kmUnit : 1,
        feePerUnit: o.feePerKm,
        deliveryFee: o.deliveryFee,
      };
    }
    if (
      typeof o.kmUnit === 'number' &&
      typeof o.feePerUnit === 'number'
    ) {
      return {
        fixedFee: o.fixedFee,
        kmUnit: o.kmUnit,
        feePerUnit: o.feePerUnit,
        deliveryFee: o.deliveryFee,
      };
    }
    return null;
  }

  buildSampleBreakdown(
    fixedFee: number,
    kmUnit: number,
    feePerUnit: number,
    previewDistanceKm = 5,
  ): DeliveryFeeBreakdown {
    return computeDeliveryFeeBreakdown(previewDistanceKm, {
      fixedFee,
      kmUnit,
      feePerUnit,
    });
  }

  private mapRow(row: {
    id: string;
    name: string | null;
    fixedFee: Prisma.Decimal;
    kmUnit: Prisma.Decimal;
    feePerUnit: Prisma.Decimal;
    sampleBreakdown: unknown;
    isActive: boolean;
    sortOrder: number;
    createdAt: Date;
    updatedAt: Date;
  }): DeliveryFeeConfigItem {
    return {
      id: row.id,
      name: row.name,
      fixedFee: this.toNumber(row.fixedFee),
      kmUnit: this.toNumber(row.kmUnit),
      feePerUnit: this.toNumber(row.feePerUnit),
      sampleBreakdown: this.parseBreakdown(row.sampleBreakdown),
      isActive: row.isActive,
      sortOrder: row.sortOrder,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  toFormula(row: {
    fixedFee: Prisma.Decimal;
    kmUnit: Prisma.Decimal;
    feePerUnit: Prisma.Decimal;
  }): DeliveryFeeFormula {
    return {
      fixedFee: this.toNumber(row.fixedFee),
      kmUnit: this.toNumber(row.kmUnit),
      feePerUnit: this.toNumber(row.feePerUnit),
    };
  }

  private async deactivateOthersExcept(exceptId?: string) {
    await this.prisma.deliveryFeeConfig.updateMany({
      where: exceptId ? { id: { not: exceptId } } : {},
      data: { isActive: false },
    });
  }

  async findAllAdmin(): Promise<DeliveryFeeConfigItem[]> {
    const rows = await this.prisma.deliveryFeeConfig.findMany({
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    return rows.map((row) => this.mapRow(row));
  }

  async findOneAdmin(id: string): Promise<DeliveryFeeConfigItem> {
    const row = await this.prisma.deliveryFeeConfig.findUnique({
      where: { id },
    });
    if (!row) {
      throw new NotFoundException('Delivery fee config not found');
    }
    return this.mapRow(row);
  }

  async getActiveConfig(): Promise<DeliveryFeeConfigItem> {
    const row = await this.prisma.deliveryFeeConfig.findFirst({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    if (!row) {
      throw new NotFoundException(
        'No active delivery fee configuration. Ask a super admin to activate one.',
      );
    }
    return this.mapRow(row);
  }

  async getActiveFormula(): Promise<DeliveryFeeFormula> {
    try {
      const active = await this.getActiveConfig();
      return {
        fixedFee: active.fixedFee,
        kmUnit: active.kmUnit,
        feePerUnit: active.feePerUnit,
      };
    } catch {
      return DEFAULT_DELIVERY_FEE_FORMULA;
    }
  }

  async computeForDistance(
    distanceKm: number,
  ): Promise<DeliveryFeeBreakdown & { configId: string | null }> {
    const config = await this.getActiveConfig().catch(() => null);
    const formula = config
      ? {
          fixedFee: config.fixedFee,
          kmUnit: config.kmUnit,
          feePerUnit: config.feePerUnit,
        }
      : DEFAULT_DELIVERY_FEE_FORMULA;
    return {
      configId: config?.id ?? null,
      ...computeDeliveryFeeBreakdown(distanceKm, formula),
    };
  }

  async createAdmin(
    dto: CreateDeliveryFeeConfigDto,
  ): Promise<DeliveryFeeConfigItem> {
    const isActive = dto.isActive ?? false;
    if (isActive) {
      await this.deactivateOthersExcept();
    }

    const sampleBreakdown = this.buildSampleBreakdown(
      dto.fixedFee,
      dto.kmUnit,
      dto.feePerUnit,
      dto.previewDistanceKm ?? 5,
    );

    const row = await this.prisma.deliveryFeeConfig.create({
      data: {
        name: dto.name?.trim() || null,
        fixedFee: dto.fixedFee,
        kmUnit: dto.kmUnit,
        feePerUnit: dto.feePerUnit,
        sampleBreakdown: sampleBreakdown as unknown as Prisma.InputJsonValue,
        isActive,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
    return this.mapRow(row);
  }

  async updateAdmin(
    id: string,
    dto: UpdateDeliveryFeeConfigDto,
  ): Promise<DeliveryFeeConfigItem> {
    const existing = await this.prisma.deliveryFeeConfig.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException('Delivery fee config not found');
    }

    if (dto.isActive === true) {
      await this.deactivateOthersExcept(id);
    }

    const fixedFee =
      dto.fixedFee !== undefined
        ? dto.fixedFee
        : this.toNumber(existing.fixedFee);
    const kmUnit =
      dto.kmUnit !== undefined ? dto.kmUnit : this.toNumber(existing.kmUnit);
    const feePerUnit =
      dto.feePerUnit !== undefined
        ? dto.feePerUnit
        : this.toNumber(existing.feePerUnit);

    const shouldRefreshSample =
      dto.fixedFee !== undefined ||
      dto.kmUnit !== undefined ||
      dto.feePerUnit !== undefined ||
      dto.previewDistanceKm !== undefined;

    const sampleBreakdown = shouldRefreshSample
      ? this.buildSampleBreakdown(
          fixedFee,
          kmUnit,
          feePerUnit,
          dto.previewDistanceKm ?? 5,
        )
      : undefined;

    const row = await this.prisma.deliveryFeeConfig.update({
      where: { id },
      data: {
        ...(dto.name !== undefined
          ? { name: dto.name.trim() || null }
          : {}),
        ...(dto.fixedFee !== undefined ? { fixedFee: dto.fixedFee } : {}),
        ...(dto.kmUnit !== undefined ? { kmUnit: dto.kmUnit } : {}),
        ...(dto.feePerUnit !== undefined ? { feePerUnit: dto.feePerUnit } : {}),
        ...(sampleBreakdown !== undefined
          ? {
              sampleBreakdown:
                sampleBreakdown as unknown as Prisma.InputJsonValue,
            }
          : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
      },
    });
    return this.mapRow(row);
  }

  async deleteAdmin(id: string): Promise<{ deleted: true; id: string }> {
    const existing = await this.prisma.deliveryFeeConfig.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException('Delivery fee config not found');
    }
    await this.prisma.deliveryFeeConfig.delete({ where: { id } });
    return { deleted: true, id };
  }

  async quote(query: QuoteDeliveryFeeQueryDto) {
    if (query.distanceKm !== undefined && Number.isFinite(query.distanceKm)) {
      return this.computeForDistance(query.distanceKm);
    }

    const { fromLat, fromLng, toLat, toLng } = query;
    if (
      fromLat !== undefined &&
      fromLng !== undefined &&
      toLat !== undefined &&
      toLng !== undefined
    ) {
      const formula = await this.getActiveFormula();
      const config = await this.getActiveConfig().catch(() => null);
      const result = deliveryFeeBetweenPoints(
        fromLat,
        fromLng,
        toLat,
        toLng,
        formula,
      );
      return { configId: config?.id ?? null, ...result };
    }

    throw new BadRequestException(
      'Provide distanceKm or fromLat, fromLng, toLat, and toLng',
    );
  }
}
