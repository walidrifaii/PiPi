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
import { CloudinaryService } from '../common/cloudinary.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMerchantOfferAdminDto } from './dto/create-merchant-offer-admin.dto';
import { UpdateMerchantOfferAdminDto } from './dto/update-merchant-offer-admin.dto';

export type MerchantOfferView = {
  id: string;
  merchantId: string;
  title: string | null;
  /** Display badge only — checkout uses product list/discount prices. */
  discountPercent: number;
  imageUrl: string;
  isActive: boolean;
  endsAt: Date;
  isExpired: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type AdminMerchantOfferView = MerchantOfferView & {
  merchant: {
    id: string;
    name: string;
    logoUrl: string | null;
  };
};

export type PublicMerchantOfferView = MerchantOfferView & {
  merchant: {
    id: string;
    name: string;
    logoUrl: string | null;
  };
};

@Injectable()
export class MerchantOfferService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudinary: CloudinaryService,
  ) {}

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

  private isExpiredAt(endsAt: Date, now = new Date()): boolean {
    return endsAt.getTime() <= now.getTime();
  }

  private parseEndsAt(value: string): Date {
    const endsAt = new Date(value);
    if (Number.isNaN(endsAt.getTime())) {
      throw new BadRequestException('endsAt must be a valid ISO date-time');
    }
    return endsAt;
  }

  private assertEndsAtInFuture(endsAt: Date, now = new Date()) {
    if (this.isExpiredAt(endsAt, now)) {
      throw new BadRequestException('endsAt must be in the future');
    }
  }

  private liveOfferWhere(now = new Date()): Prisma.MerchantOfferWhereInput {
    return {
      isActive: true,
      endsAt: { gt: now },
    };
  }

  private mapRow(
    row: {
      id: string;
      merchantId: string;
      title: string | null;
      discountPercent: { toString(): string };
      imageUrl: string;
      isActive: boolean;
      endsAt: Date;
      createdAt: Date;
      updatedAt: Date;
    },
    now = new Date(),
  ): MerchantOfferView {
    const isExpired = this.isExpiredAt(row.endsAt, now);
    return {
      id: row.id,
      merchantId: row.merchantId,
      title: row.title,
      discountPercent: Number(row.discountPercent),
      imageUrl: row.imageUrl,
      isActive: row.isActive && !isExpired,
      endsAt: row.endsAt,
      isExpired,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  requireImageFile(file?: Express.Multer.File): Buffer {
    if (!file?.buffer?.length) {
      throw new BadRequestException('image file is required');
    }
    return file.buffer;
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
      where: { isActive: true },
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
          merchant: { select: { id: true, name: true, imageUrl: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: pg.skip,
        take: pg.limit,
      }),
    ]);

    const items: AdminMerchantOfferView[] = rows.map((r) => ({
      ...this.mapRow(r, now),
      merchant: {
        id: r.merchant.id,
        name: r.merchant.name,
        logoUrl: r.merchant.imageUrl,
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
        merchant: { select: { id: true, name: true, imageUrl: true } },
      },
    });
    if (!row) {
      throw new NotFoundException('Offer not found');
    }
    return {
      ...this.mapRow(row, now),
      merchant: {
        id: row.merchant.id,
        name: row.merchant.name,
        logoUrl: row.merchant.imageUrl,
      },
    };
  }

  async createForAdmin(dto: CreateMerchantOfferAdminDto, imageUrl: string) {
    await this.assertMerchantExists(dto.merchantId);
    await this.expireDueOffers(dto.merchantId);

    const endsAt = this.parseEndsAt(dto.endsAt);
    const isActive = dto.isActive ?? true;
    if (isActive) {
      this.assertEndsAtInFuture(endsAt);
    }

    const row = await this.prisma.merchantOffer.create({
      data: {
        merchantId: dto.merchantId,
        title: dto.title?.trim() || null,
        discountPercent: new Prisma.Decimal(dto.discountPercent),
        imageUrl,
        isActive,
        endsAt,
      },
    });

    return this.mapRow(row);
  }

  async updateForAdmin(
    offerId: string,
    dto: UpdateMerchantOfferAdminDto,
    imageUrl?: string,
  ) {
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

    const nextEndsAt =
      dto.endsAt !== undefined
        ? this.parseEndsAt(dto.endsAt)
        : existing.endsAt;
    const nextActive =
      dto.isActive !== undefined ? dto.isActive : existing.isActive;

    if (nextActive) {
      this.assertEndsAtInFuture(nextEndsAt);
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
        ...(dto.endsAt !== undefined ? { endsAt: nextEndsAt } : {}),
        ...(imageUrl !== undefined ? { imageUrl } : {}),
      },
    });

    if (imageUrl !== undefined && imageUrl !== existing.imageUrl) {
      await this.cloudinary.deleteImageByUrl(existing.imageUrl);
    }

    return this.mapRow(row);
  }

  async removeForAdmin(offerId: string) {
    const existing = await this.prisma.merchantOffer.findUnique({
      where: { id: offerId },
    });
    if (!existing) {
      throw new NotFoundException('Offer not found');
    }

    await this.prisma.merchantOffer.delete({ where: { id: offerId } });
    await this.cloudinary.deleteImageByUrl(existing.imageUrl);

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
        orderBy: { createdAt: 'desc' },
        skip: pg.skip,
        take: pg.limit,
      }),
    ]);

    return this.pagedResponse(
      rows.map((r) => this.mapRow(r, now)),
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
    });
    if (!row) {
      throw new NotFoundException('Offer not found');
    }
    return this.mapRow(row, now);
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
            select: { id: true, name: true, imageUrl: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: pg.skip,
        take: pg.limit,
      }),
    ]);

    const items: PublicMerchantOfferView[] = rows.map((r) => ({
      ...this.mapRow(r, now),
      merchant: {
        id: r.merchant.id,
        name: r.merchant.name,
        logoUrl: r.merchant.imageUrl,
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
