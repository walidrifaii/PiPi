import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  computeMerchantOpenNow,
  workingIntervalsToWeek,
} from '../common/merchant-open-status';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMerchantOfferAdminDto } from './dto/create-merchant-offer-admin.dto';
import { UpdateMerchantOfferAdminDto } from './dto/update-merchant-offer-admin.dto';

type MerchantImageFields = {
  imageUrl: string | null;
  coverImageUrl: string | null;
};

export type MerchantOfferView = {
  id: string;
  merchantId: string;
  title: string | null;
  /** Display badge only — checkout uses product list/discount prices. */
  discountPercent: number;
  /** Merchant cover image, then logo — not a separate offer upload. */
  imageUrl: string | null;
  isActive: boolean;
  startsAt: Date;
  endsAt: Date;
  isNotStarted: boolean;
  isExpired: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type AdminMerchantOfferView = MerchantOfferView & {
  merchant: {
    id: string;
    name: string;
    logoUrl: string | null;
    coverImageUrl: string | null;
  };
};

export type PublicMerchantOfferView = MerchantOfferView & {
  merchant: {
    id: string;
    name: string;
    logoUrl: string | null;
    coverImageUrl: string | null;
  };
};

@Injectable()
export class MerchantOfferService {
  constructor(private readonly prisma: PrismaService) {}

  private normalizePagination(page: number, limit: number) {
    const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
    const safeLimit =
      Number.isFinite(limit) && limit > 0
        ? Math.min(Math.floor(limit), 50)
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

  private parseDateField(value: string, field: string): Date {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException(`${field} must be a valid ISO date-time`);
    }
    return parsed;
  }

  private assertValidOfferWindow(startsAt: Date, endsAt: Date) {
    if (startsAt.getTime() >= endsAt.getTime()) {
      throw new BadRequestException('startsAt must be before endsAt');
    }
  }

  private isNotStartedAt(startsAt: Date, now = new Date()): boolean {
    return startsAt.getTime() > now.getTime();
  }

  private isExpiredAt(endsAt: Date, now = new Date()): boolean {
    return endsAt.getTime() <= now.getTime();
  }

  private parseStartsAt(value: string): Date {
    return this.parseDateField(value, 'startsAt');
  }

  private parseEndsAt(value: string): Date {
    return this.parseDateField(value, 'endsAt');
  }

  private liveOfferWhere(now = new Date()): Prisma.MerchantOfferWhereInput {
    return {
      isActive: true,
      startsAt: { lte: now },
      endsAt: { gt: now },
    };
  }

  private resolveDisplayImageUrl(
    merchant: MerchantImageFields,
  ): string | null {
    return merchant.coverImageUrl ?? merchant.imageUrl ?? null;
  }

  private mapRow(
    row: {
      id: string;
      merchantId: string;
      title: string | null;
      discountPercent: { toString(): string };
      isActive: boolean;
      startsAt: Date;
      endsAt: Date;
      createdAt: Date;
      updatedAt: Date;
    },
    now = new Date(),
    merchant?: MerchantImageFields,
  ): MerchantOfferView {
    const isExpired = this.isExpiredAt(row.endsAt, now);
    const isNotStarted = this.isNotStartedAt(row.startsAt, now);
    return {
      id: row.id,
      merchantId: row.merchantId,
      title: row.title,
      discountPercent: Number(row.discountPercent),
      imageUrl: merchant ? this.resolveDisplayImageUrl(merchant) : null,
      isActive: row.isActive && !isExpired && !isNotStarted,
      startsAt: row.startsAt,
      endsAt: row.endsAt,
      isNotStarted,
      isExpired,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private mapMerchantImages(merchant: MerchantImageFields) {
    return {
      logoUrl: merchant.imageUrl,
      coverImageUrl: merchant.coverImageUrl,
    };
  }

  private async loadMerchantImages(merchantId: string) {
    const merchant = await this.prisma.merchant.findUnique({
      where: { id: merchantId },
      select: { imageUrl: true, coverImageUrl: true },
    });
    if (!merchant) {
      throw new NotFoundException('Merchant not found');
    }
    return merchant;
  }

  private async assertMerchantExists(merchantId: string) {
    const merchant = await this.prisma.merchant.findUnique({
      where: { id: merchantId },
      select: { id: true },
    });
    if (!merchant) {
      throw new NotFoundException('Merchant not found');
    }
  }

  /** Deactivate promos past endsAt (display-only; no product price changes). */
  async expireDueOffers(merchantId?: string) {
    const now = new Date();
    await this.prisma.merchantOffer.updateMany({
      where: {
        isActive: true,
        endsAt: { lte: now },
        ...(merchantId ? { merchantId } : {}),
      },
      data: { isActive: false },
    });
  }

  private async merchantIdsOpenForBusiness(): Promise<string[]> {
    const rows = await this.prisma.merchant.findMany({
      where: { isActive: true, isEnabled: true },
      select: {
        id: true,
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
      },
    });
    return rows
      .filter((r) => {
        const week = workingIntervalsToWeek(r.workingIntervals);
        const weekOrNull = week.days.length > 0 ? week : null;
        return computeMerchantOpenNow({
          isActive: r.isActive,
          useWorkingHours: r.useWorkingHours,
          timezone: r.timezone,
          week: weekOrNull,
        });
      })
      .map((r) => r.id);
  }

  async listAllAdmin(page = 1, limit = 20, merchantId?: string) {
    await this.expireDueOffers();
    const now = new Date();
    const pg = this.normalizePagination(page, limit);
    const where: Prisma.MerchantOfferWhereInput = merchantId?.trim()
      ? { merchantId: merchantId.trim() }
      : {};

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.merchantOffer.count({ where }),
      this.prisma.merchantOffer.findMany({
        where,
        include: {
          merchant: {
            select: { id: true, name: true, imageUrl: true, coverImageUrl: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: pg.skip,
        take: pg.limit,
      }),
    ]);

    const items: AdminMerchantOfferView[] = rows.map((r) => ({
      ...this.mapRow(r, now, r.merchant),
      merchant: {
        id: r.merchant.id,
        name: r.merchant.name,
        ...this.mapMerchantImages(r.merchant),
      },
    }));

    return this.pagedResponse(items, total, pg.page, pg.limit);
  }

  async findOneAdmin(offerId: string) {
    await this.expireDueOffers();
    const now = new Date();
    const row = await this.prisma.merchantOffer.findUnique({
      where: { id: offerId },
      include: {
        merchant: {
          select: { id: true, name: true, imageUrl: true, coverImageUrl: true },
        },
      },
    });
    if (!row) {
      throw new NotFoundException('Offer not found');
    }
    return {
      ...this.mapRow(row, now, row.merchant),
      merchant: {
        id: row.merchant.id,
        name: row.merchant.name,
        ...this.mapMerchantImages(row.merchant),
      },
    };
  }

  async createForAdmin(dto: CreateMerchantOfferAdminDto) {
    await this.assertMerchantExists(dto.merchantId);
    await this.expireDueOffers(dto.merchantId);

    const startsAt = this.parseStartsAt(dto.startsAt);
    const endsAt = this.parseEndsAt(dto.endsAt);
    this.assertValidOfferWindow(startsAt, endsAt);
    const isActive = dto.isActive ?? true;
    if (isActive && this.isExpiredAt(endsAt)) {
      throw new BadRequestException('endsAt must be in the future for active offers');
    }

    const row = await this.prisma.merchantOffer.create({
      data: {
        merchantId: dto.merchantId,
        title: dto.title?.trim() || null,
        discountPercent: new Prisma.Decimal(dto.discountPercent),
        isActive,
        startsAt,
        endsAt,
      },
    });

    const merchant = await this.loadMerchantImages(row.merchantId);
    return this.mapRow(row, new Date(), merchant);
  }

  async updateForAdmin(offerId: string, dto: UpdateMerchantOfferAdminDto) {
    const existing = await this.prisma.merchantOffer.findUnique({
      where: { id: offerId },
    });
    if (!existing) {
      throw new NotFoundException('Offer not found');
    }

    if (dto.merchantId !== undefined) {
      await this.assertMerchantExists(dto.merchantId);
    }

    await this.expireDueOffers(existing.merchantId);

    const nextStartsAt =
      dto.startsAt !== undefined
        ? this.parseStartsAt(dto.startsAt)
        : existing.startsAt;
    const nextEndsAt =
      dto.endsAt !== undefined
        ? this.parseEndsAt(dto.endsAt)
        : existing.endsAt;
    this.assertValidOfferWindow(nextStartsAt, nextEndsAt);
    const nextActive =
      dto.isActive !== undefined ? dto.isActive : existing.isActive;

    if (nextActive && this.isExpiredAt(nextEndsAt)) {
      throw new BadRequestException('endsAt must be in the future for active offers');
    }

    const row = await this.prisma.merchantOffer.update({
      where: { id: offerId },
      data: {
        ...(dto.merchantId !== undefined ? { merchantId: dto.merchantId } : {}),
        ...(dto.title !== undefined
          ? { title: dto.title.trim() || null }
          : {}),
        ...(dto.discountPercent !== undefined
          ? { discountPercent: new Prisma.Decimal(dto.discountPercent) }
          : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        ...(dto.startsAt !== undefined ? { startsAt: nextStartsAt } : {}),
        ...(dto.endsAt !== undefined ? { endsAt: nextEndsAt } : {}),
      },
    });

    const merchant = await this.loadMerchantImages(row.merchantId);
    return this.mapRow(row, new Date(), merchant);
  }

  async removeForAdmin(offerId: string) {
    const existing = await this.prisma.merchantOffer.findUnique({
      where: { id: offerId },
    });
    if (!existing) {
      throw new NotFoundException('Offer not found');
    }

    await this.prisma.merchantOffer.delete({ where: { id: offerId } });

    return { message: 'Offer deleted' };
  }

  /** Merchant read-only: promos assigned to their store by super admin. */
  async listForMerchant(merchantId: string, page = 1, limit = 20) {
    await this.assertMerchantExists(merchantId);
    await this.expireDueOffers(merchantId);
    const now = new Date();
    const pg = this.normalizePagination(page, limit);
    const where = { merchantId };

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.merchantOffer.count({ where }),
      this.prisma.merchantOffer.findMany({
        where,
        include: {
          merchant: {
            select: { imageUrl: true, coverImageUrl: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: pg.skip,
        take: pg.limit,
      }),
    ]);

    return this.pagedResponse(
      rows.map((r) => this.mapRow(r, now, r.merchant)),
      total,
      pg.page,
      pg.limit,
    );
  }

  async findOneForMerchant(merchantId: string, offerId: string) {
    await this.expireDueOffers(merchantId);
    const now = new Date();
    const row = await this.prisma.merchantOffer.findFirst({
      where: { id: offerId, merchantId },
      include: {
        merchant: {
          select: { imageUrl: true, coverImageUrl: true },
        },
      },
    });
    if (!row) {
      throw new NotFoundException('Offer not found');
    }
    return this.mapRow(row, now, row.merchant);
  }

  /** Public storefront: live display promos for open merchants. */
  async listPublic(page = 1, limit = 20, merchantId?: string) {
    await this.expireDueOffers();
    const now = new Date();
    const pg = this.normalizePagination(page, limit);
    const openIds = await this.merchantIdsOpenForBusiness();
    if (openIds.length === 0) {
      return this.pagedResponse([], 0, pg.page, pg.limit);
    }

    if (merchantId?.trim()) {
      if (!openIds.includes(merchantId.trim())) {
        return this.pagedResponse([], 0, pg.page, pg.limit);
      }
    }

    const where: Prisma.MerchantOfferWhereInput = {
      ...this.liveOfferWhere(now),
      merchantId: merchantId?.trim() ? merchantId.trim() : { in: openIds },
    };

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.merchantOffer.count({ where }),
      this.prisma.merchantOffer.findMany({
        where,
        include: {
          merchant: {
            select: { id: true, name: true, imageUrl: true, coverImageUrl: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: pg.skip,
        take: pg.limit,
      }),
    ]);

    const items: PublicMerchantOfferView[] = rows.map((r) => ({
      ...this.mapRow(r, now, r.merchant),
      merchant: {
        id: r.merchant.id,
        name: r.merchant.name,
        ...this.mapMerchantImages(r.merchant),
      },
    }));

    return this.pagedResponse(items, total, pg.page, pg.limit);
  }

  /** Active promo percent for storefront pricing, or null if none / expired. */
  async getLiveOfferPercentForMerchant(
    merchantId: string,
  ): Promise<number | null> {
    await this.expireDueOffers(merchantId);
    const now = new Date();
    const row = await this.prisma.merchantOffer.findFirst({
      where: { merchantId, ...this.liveOfferWhere(now) },
      select: { discountPercent: true },
      orderBy: { createdAt: 'desc' },
    });
    return row ? Number(row.discountPercent) : null;
  }
}
