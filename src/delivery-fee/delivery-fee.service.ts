import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  computeDeliveryFeeBreakdown,
  DEFAULT_DELIVERY_FEE_FORMULA,
  DEFAULT_INCLUDED_KM,
  DEFAULT_MAX_FEE,
  DEFAULT_MAX_KM,
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
  includedKm: number;
  kmUnit: number;
  feePerUnit: number;
  maxFee: number;
  maxKm: number;
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

  private assertFormula(
    fixedFee: number,
    includedKm: number,
    maxFee: number,
    maxKm: number,
  ) {
    if (maxFee < fixedFee) {
      throw new BadRequestException(
        'maxFee must be greater than or equal to fixedFee (minimum charge)',
      );
    }
    if (maxKm < includedKm) {
      throw new BadRequestException(
        'maxKm must be greater than or equal to includedKm',
      );
    }
  }

  private parseBreakdown(raw: unknown): DeliveryFeeBreakdown | null {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      return null;
    }
    const o = raw as Record<string, unknown>;
    if (typeof o.fixedFee !== 'number' || typeof o.deliveryFee !== 'number') {
      return null;
    }
    const kmUnit = typeof o.kmUnit === 'number' ? o.kmUnit : 1;
    const feePerUnit =
      typeof o.feePerUnit === 'number'
        ? o.feePerUnit
        : typeof o.feePerKm === 'number'
          ? o.feePerKm
          : 1;
    const includedKm =
      typeof o.includedKm === 'number' ? o.includedKm : DEFAULT_INCLUDED_KM;
    const maxFee =
      typeof o.maxFee === 'number'
        ? o.maxFee
        : Math.max(o.fixedFee as number, DEFAULT_MAX_FEE);
    const maxKm =
      typeof o.maxKm === 'number'
        ? o.maxKm
        : Math.max(includedKm, DEFAULT_MAX_KM);

    return {
      fixedFee: o.fixedFee,
      includedKm,
      kmUnit,
      feePerUnit,
      maxFee,
      maxKm,
      deliveryFee: o.deliveryFee,
    };
  }

  buildSampleBreakdown(
    formula: DeliveryFeeFormula,
    previewDistanceKm = 5,
  ): DeliveryFeeBreakdown {
    return computeDeliveryFeeBreakdown(previewDistanceKm, formula);
  }

  private mapRow(row: {
    id: string;
    name: string | null;
    fixedFee: Prisma.Decimal;
    includedKm: Prisma.Decimal;
    kmUnit: Prisma.Decimal;
    feePerUnit: Prisma.Decimal;
    maxFee: Prisma.Decimal;
    maxKm: Prisma.Decimal;
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
      includedKm: this.toNumber(row.includedKm),
      kmUnit: this.toNumber(row.kmUnit),
      feePerUnit: this.toNumber(row.feePerUnit),
      maxFee: this.toNumber(row.maxFee),
      maxKm: this.toNumber(row.maxKm),
      sampleBreakdown: this.parseBreakdown(row.sampleBreakdown),
      isActive: row.isActive,
      sortOrder: row.sortOrder,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  toFormula(row: {
    fixedFee: Prisma.Decimal;
    includedKm: Prisma.Decimal;
    kmUnit: Prisma.Decimal;
    feePerUnit: Prisma.Decimal;
    maxFee: Prisma.Decimal;
    maxKm: Prisma.Decimal;
  }): DeliveryFeeFormula {
    return {
      fixedFee: this.toNumber(row.fixedFee),
      includedKm: this.toNumber(row.includedKm),
      kmUnit: this.toNumber(row.kmUnit),
      feePerUnit: this.toNumber(row.feePerUnit),
      maxFee: this.toNumber(row.maxFee),
      maxKm: this.toNumber(row.maxKm),
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
        includedKm: active.includedKm,
        kmUnit: active.kmUnit,
        feePerUnit: active.feePerUnit,
        maxFee: active.maxFee,
        maxKm: active.maxKm,
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
          includedKm: config.includedKm,
          kmUnit: config.kmUnit,
          feePerUnit: config.feePerUnit,
          maxFee: config.maxFee,
          maxKm: config.maxKm,
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
    this.assertFormula(dto.fixedFee, dto.includedKm, dto.maxFee, dto.maxKm);

    const isActive = dto.isActive ?? false;
    if (isActive) {
      await this.deactivateOthersExcept();
    }

    const formula: DeliveryFeeFormula = {
      fixedFee: dto.fixedFee,
      includedKm: dto.includedKm,
      kmUnit: dto.kmUnit,
      feePerUnit: dto.feePerUnit,
      maxFee: dto.maxFee,
      maxKm: dto.maxKm,
    };

    const sampleBreakdown = this.buildSampleBreakdown(
      formula,
      dto.previewDistanceKm ?? 5,
    );

    const row = await this.prisma.deliveryFeeConfig.create({
      data: {
        name: dto.name?.trim() || null,
        fixedFee: dto.fixedFee,
        includedKm: dto.includedKm,
        kmUnit: dto.kmUnit,
        feePerUnit: dto.feePerUnit,
        maxFee: dto.maxFee,
        maxKm: dto.maxKm,
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
    const includedKm =
      dto.includedKm !== undefined
        ? dto.includedKm
        : this.toNumber(existing.includedKm);
    const kmUnit =
      dto.kmUnit !== undefined ? dto.kmUnit : this.toNumber(existing.kmUnit);
    const feePerUnit =
      dto.feePerUnit !== undefined
        ? dto.feePerUnit
        : this.toNumber(existing.feePerUnit);
    const maxFee =
      dto.maxFee !== undefined ? dto.maxFee : this.toNumber(existing.maxFee);
    const maxKm =
      dto.maxKm !== undefined ? dto.maxKm : this.toNumber(existing.maxKm);

    this.assertFormula(fixedFee, includedKm, maxFee, maxKm);

    const shouldRefreshSample =
      dto.fixedFee !== undefined ||
      dto.includedKm !== undefined ||
      dto.kmUnit !== undefined ||
      dto.feePerUnit !== undefined ||
      dto.maxFee !== undefined ||
      dto.maxKm !== undefined ||
      dto.previewDistanceKm !== undefined;

    const sampleBreakdown = shouldRefreshSample
      ? this.buildSampleBreakdown(
          { fixedFee, includedKm, kmUnit, feePerUnit, maxFee, maxKm },
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
        ...(dto.includedKm !== undefined ? { includedKm: dto.includedKm } : {}),
        ...(dto.kmUnit !== undefined ? { kmUnit: dto.kmUnit } : {}),
        ...(dto.feePerUnit !== undefined ? { feePerUnit: dto.feePerUnit } : {}),
        ...(dto.maxFee !== undefined ? { maxFee: dto.maxFee } : {}),
        ...(dto.maxKm !== undefined ? { maxKm: dto.maxKm } : {}),
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
