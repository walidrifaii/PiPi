import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  computeDeliveryFeeBreakdown,
  type DeliveryFeeBreakdown,
  type DeliveryFeeFormula,
} from '../common/delivery-fee';
import { PrismaService } from '../prisma/prisma.service';
import {
  DEFAULT_PICKUP_FEE_PER_UNIT,
  DEFAULT_PICKUP_FIXED_FEE,
  DEFAULT_PICKUP_INCLUDED_KM,
  DEFAULT_PICKUP_KM_UNIT,
  DEFAULT_PICKUP_MAX_FEE,
  DEFAULT_PICKUP_MAX_KM,
} from './pickup.constants';
import {
  CreatePickupDeliveryFeeConfigDto,
  UpdatePickupDeliveryFeeConfigDto,
} from './dto/pickup-delivery-fee.dto';

export type PickupDeliveryFeeConfigView = {
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

const DEFAULT_FORMULA: DeliveryFeeFormula = {
  fixedFee: DEFAULT_PICKUP_FIXED_FEE,
  includedKm: DEFAULT_PICKUP_INCLUDED_KM,
  kmUnit: DEFAULT_PICKUP_KM_UNIT,
  feePerUnit: DEFAULT_PICKUP_FEE_PER_UNIT,
  maxFee: DEFAULT_PICKUP_MAX_FEE,
  maxKm: DEFAULT_PICKUP_MAX_KM,
};

@Injectable()
export class PickupDeliveryFeeService {
  constructor(private readonly prisma: PrismaService) {}

  private toNumber(value: Prisma.Decimal | number | string): number {
    return Number(value);
  }

  private assertFormula(fixedFee: number, includedKm: number, maxFee: number, maxKm: number) {
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
  }): PickupDeliveryFeeConfigView {
    return {
      id: row.id,
      name: row.name,
      fixedFee: this.toNumber(row.fixedFee),
      includedKm: this.toNumber(row.includedKm),
      kmUnit: this.toNumber(row.kmUnit),
      feePerUnit: this.toNumber(row.feePerUnit),
      maxFee: this.toNumber(row.maxFee),
      maxKm: this.toNumber(row.maxKm),
      sampleBreakdown:
        row.sampleBreakdown && typeof row.sampleBreakdown === 'object'
          ? (row.sampleBreakdown as DeliveryFeeBreakdown)
          : null,
      isActive: row.isActive,
      sortOrder: row.sortOrder,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private async deactivateOthersExcept(exceptId?: string) {
    await this.prisma.pickupDeliveryFeeConfig.updateMany({
      where: exceptId ? { id: { not: exceptId } } : {},
      data: { isActive: false },
    });
  }

  async findAllAdmin(): Promise<PickupDeliveryFeeConfigView[]> {
    const rows = await this.prisma.pickupDeliveryFeeConfig.findMany({
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    return rows.map((row) => this.mapRow(row));
  }

  async findOneAdmin(id: string): Promise<PickupDeliveryFeeConfigView> {
    const row = await this.prisma.pickupDeliveryFeeConfig.findUnique({
      where: { id },
    });
    if (!row) {
      throw new NotFoundException('Pickup delivery fee config not found');
    }
    return this.mapRow(row);
  }

  async getActiveConfig(): Promise<PickupDeliveryFeeConfigView | null> {
    const row = await this.prisma.pickupDeliveryFeeConfig.findFirst({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    return row ? this.mapRow(row) : null;
  }

  async getActiveFormula(): Promise<DeliveryFeeFormula & { configId: string | null }> {
    const active = await this.getActiveConfig();
    if (!active) {
      return { ...DEFAULT_FORMULA, configId: null };
    }
    return {
      fixedFee: active.fixedFee,
      includedKm: active.includedKm,
      kmUnit: active.kmUnit,
      feePerUnit: active.feePerUnit,
      maxFee: active.maxFee,
      maxKm: active.maxKm,
      configId: active.id,
    };
  }

  async computeForDistance(distanceKm: number): Promise<
    DeliveryFeeBreakdown & { configId: string | null }
  > {
    const formula = await this.getActiveFormula();
    return {
      configId: formula.configId,
      ...computeDeliveryFeeBreakdown(distanceKm, formula),
    };
  }

  async createAdmin(
    dto: CreatePickupDeliveryFeeConfigDto,
  ): Promise<PickupDeliveryFeeConfigView> {
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
    const sampleBreakdown = computeDeliveryFeeBreakdown(
      dto.previewDistanceKm ?? 5,
      formula,
    );
    const row = await this.prisma.pickupDeliveryFeeConfig.create({
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
    dto: UpdatePickupDeliveryFeeConfigDto,
  ): Promise<PickupDeliveryFeeConfigView> {
    const existing = await this.prisma.pickupDeliveryFeeConfig.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException('Pickup delivery fee config not found');
    }
    if (dto.isActive === true) {
      await this.deactivateOthersExcept(id);
    }
    const fixedFee =
      dto.fixedFee !== undefined ? dto.fixedFee : this.toNumber(existing.fixedFee);
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
      ? computeDeliveryFeeBreakdown(dto.previewDistanceKm ?? 5, {
          fixedFee,
          includedKm,
          kmUnit,
          feePerUnit,
          maxFee,
          maxKm,
        })
      : undefined;

    const row = await this.prisma.pickupDeliveryFeeConfig.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() || null } : {}),
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
    const existing = await this.prisma.pickupDeliveryFeeConfig.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException('Pickup delivery fee config not found');
    }
    await this.prisma.pickupDeliveryFeeConfig.delete({ where: { id } });
    return { deleted: true, id };
  }
}
