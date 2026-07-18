import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCouponDto } from './dto/create-coupon.dto';
import { UpdateCouponDto } from './dto/update-coupon.dto';

export type CouponValidationResult =
  | {
      valid: true;
      couponId: string;
      code: string;
      discountPercent: number;
    }
  | { valid: false; reason: string };

@Injectable()
export class CouponService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Admin operations ────────────────────────────────────────────────────────

  async create(dto: CreateCouponDto) {
    const code = dto.code.toUpperCase();

    const existing = await this.prisma.coupon.findUnique({
      where: { code },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException(`Coupon code "${code}" already exists`);
    }

    const coupon = await this.prisma.coupon.create({
      data: {
        code,
        authorName: dto.authorName,
        discountPercent: dto.discountPercent,
        isActive: dto.isActive ?? true,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        maxUsages: dto.maxUsages ?? null,
      },
      select: this.adminSelect(),
    });

    return coupon;
  }

  async findAll() {
    return this.prisma.coupon.findMany({
      orderBy: { createdAt: 'desc' },
      select: this.adminSelect(),
    });
  }

  async findOne(id: string) {
    const coupon = await this.prisma.coupon.findUnique({
      where: { id },
      select: {
        ...this.adminSelect(),
        usages: {
          orderBy: { usedAt: 'desc' },
          select: {
            id: true,
            discountAmount: true,
            usedAt: true,
            orderId: true,
            user: {
              select: {
                id: true,
                fullName: true,
                phone: true,
              },
            },
          },
        },
      },
    });

    if (!coupon) {
      throw new NotFoundException('Coupon not found');
    }

    return coupon;
  }

  async update(id: string, dto: UpdateCouponDto) {
    await this.assertExists(id);

    return this.prisma.coupon.update({
      where: { id },
      data: {
        ...(dto.discountPercent !== undefined && {
          discountPercent: dto.discountPercent,
        }),
        ...(dto.expiresAt !== undefined && {
          expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        }),
        ...(dto.maxUsages !== undefined && { maxUsages: dto.maxUsages }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
      select: this.adminSelect(),
    });
  }

  async remove(id: string) {
    await this.assertExists(id);
    await this.prisma.coupon.delete({ where: { id } });
    return { deleted: true };
  }

  // ─── User-facing validation ───────────────────────────────────────────────

  /**
   * Validates that a coupon code is usable by the given user RIGHT NOW
   * (active, not expired, not over usage limit, user hasn't used it before).
   */
  async validateForUser(
    userId: string,
    rawCode: string,
  ): Promise<CouponValidationResult> {
    const code = rawCode.toUpperCase();

    const coupon = await this.prisma.coupon.findUnique({
      where: { code },
      select: {
        id: true,
        code: true,
        discountPercent: true,
        isActive: true,
        expiresAt: true,
        maxUsages: true,
        usageCount: true,
      },
    });

    if (!coupon) {
      return { valid: false, reason: 'Coupon code not found' };
    }
    if (!coupon.isActive) {
      return { valid: false, reason: 'Coupon is no longer active' };
    }
    if (coupon.expiresAt && coupon.expiresAt < new Date()) {
      return { valid: false, reason: 'Coupon has expired' };
    }
    if (
      coupon.maxUsages !== null &&
      coupon.usageCount >= coupon.maxUsages
    ) {
      return { valid: false, reason: 'Coupon usage limit has been reached' };
    }

    const alreadyUsed = await this.prisma.couponUsage.findUnique({
      where: { couponId_userId: { couponId: coupon.id, userId } },
      select: { id: true },
    });
    if (alreadyUsed) {
      return { valid: false, reason: 'You have already used this coupon' };
    }

    return {
      valid: true,
      couponId: coupon.id,
      code: coupon.code,
      discountPercent: Number(coupon.discountPercent),
    };
  }

  /**
   * Called inside the checkout transaction to apply the coupon.
   * Returns the validated coupon data or throws if invalid at that instant.
   *
   * @param lineItemsHaveProductDiscount Legacy flag (always false); kept for call-site compatibility.
   */
  async assertValidForCheckout(
    userId: string,
    rawCode: string,
    lineItemsHaveProductDiscount: boolean,
  ) {
    if (lineItemsHaveProductDiscount) {
      throw new BadRequestException(
        'Coupon codes cannot be combined with items that already have a discount',
      );
    }

    const result = await this.validateForUser(userId, rawCode);
    if (!result.valid) {
      throw new BadRequestException(result.reason);
    }

    return result;
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private async assertExists(id: string) {
    const row = await this.prisma.coupon.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!row) throw new NotFoundException('Coupon not found');
  }

  private adminSelect() {
    return {
      id: true,
      code: true,
      authorName: true,
      discountPercent: true,
      isActive: true,
      expiresAt: true,
      maxUsages: true,
      usageCount: true,
      createdAt: true,
      updatedAt: true,
    } as const;
  }
}
