import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { S3Service } from '../common/s3.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBundleAdminDto } from './dto/create-bundle-admin.dto';
import { CreateBundleMerchantDto } from './dto/create-bundle-merchant.dto';
import { UpdateBundleAdminDto } from './dto/update-bundle-admin.dto';
import { UpdateBundleMerchantDto } from './dto/update-bundle-merchant.dto';

export const MAX_BUNDLES_PER_MERCHANT = 5;

export type BundleStatus = 'ACTIVE' | 'INACTIVE';

export type BundleMerchantSummary = {
  id: string;
  name: string;
  nameAr?: string | null;
  logoUrl: string | null;
};

export type BundleView = {
  id: string;
  merchantId: string;
  title: string;
  titleAr: string | null;
  description: string | null;
  descriptionAr: string | null;
  price: number;
  imageUrl: string;
  isActive: boolean;
  status: BundleStatus;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
  merchant?: BundleMerchantSummary;
};

type BundleRow = {
  id: string;
  merchantId: string;
  title: string;
  titleAr: string | null;
  description: string | null;
  descriptionAr: string | null;
  price: { toString(): string };
  imageUrl: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
};

type MerchantLogoRow = {
  id: string;
  name: string;
  nameAr?: string | null;
  imageUrl: string | null;
};

@Injectable()
export class BundleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly s3: S3Service,
  ) {}

  requireImageFile(file?: Express.Multer.File): Buffer {
    if (!file?.buffer?.length) {
      throw new BadRequestException('image file is required');
    }
    return file.buffer;
  }

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

  private mapMerchantSummary(merchant: MerchantLogoRow): BundleMerchantSummary {
    return {
      id: merchant.id,
      name: merchant.name,
      nameAr: merchant.nameAr ?? null,
      logoUrl: merchant.imageUrl,
    };
  }

  private mapRow(
    row: BundleRow,
    merchant?: MerchantLogoRow,
  ): BundleView {
    return {
      id: row.id,
      merchantId: row.merchantId,
      title: row.title,
      titleAr: row.titleAr,
      description: row.description,
      descriptionAr: row.descriptionAr,
      price: Number(row.price),
      imageUrl: row.imageUrl,
      isActive: row.isActive,
      status: row.isActive ? 'ACTIVE' : 'INACTIVE',
      sortOrder: row.sortOrder,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      ...(merchant ? { merchant: this.mapMerchantSummary(merchant) } : {}),
    };
  }

  private merchantInclude = {
    merchant: {
      select: {
        id: true,
        name: true,
        nameAr: true,
        imageUrl: true,
      },
    },
  } as const;

  private async assertMerchantExists(merchantId: string) {
    const merchant = await this.prisma.merchant.findUnique({
      where: { id: merchantId },
      select: { id: true },
    });
    if (!merchant) {
      throw new NotFoundException('Merchant not found');
    }
  }

  private async assertMerchantBundleLimit(merchantId: string) {
    const count = await this.prisma.merchantBundle.count({
      where: { merchantId },
    });
    if (count >= MAX_BUNDLES_PER_MERCHANT) {
      throw new BadRequestException(
        `A merchant can have at most ${MAX_BUNDLES_PER_MERCHANT} bundles`,
      );
    }
  }

  private async findBundleOrThrow(bundleId: string) {
    const row = await this.prisma.merchantBundle.findUnique({
      where: { id: bundleId },
      include: this.merchantInclude,
    });
    if (!row) {
      throw new NotFoundException('Bundle not found');
    }
    return row;
  }

  private async deleteBundleImage(imageUrl: string | null | undefined) {
    if (imageUrl) {
      await this.s3.deleteImageByUrl(imageUrl);
    }
  }

  private buildCreateData(
    dto: CreateBundleMerchantDto,
    merchantId: string,
    imageUrl: string,
  ): Prisma.MerchantBundleCreateInput {
    return {
      merchant: { connect: { id: merchantId } },
      title: dto.title.trim(),
      titleAr: dto.titleAr?.trim() || null,
      description: dto.description?.trim() || null,
      descriptionAr: dto.descriptionAr?.trim() || null,
      price: new Prisma.Decimal(dto.price),
      imageUrl,
      isActive: dto.isActive ?? true,
      sortOrder: dto.sortOrder ?? 0,
    };
  }

  private buildUpdateData(
    dto: UpdateBundleMerchantDto,
    imageUrl?: string,
  ): Prisma.MerchantBundleUpdateInput {
    return {
      ...(imageUrl !== undefined ? { imageUrl } : {}),
      ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
      ...(dto.titleAr !== undefined
        ? { titleAr: dto.titleAr.trim() || null }
        : {}),
      ...(dto.description !== undefined
        ? { description: dto.description.trim() || null }
        : {}),
      ...(dto.descriptionAr !== undefined
        ? { descriptionAr: dto.descriptionAr.trim() || null }
        : {}),
      ...(dto.price !== undefined
        ? { price: new Prisma.Decimal(dto.price) }
        : {}),
      ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
    };
  }

  async listPublic(page = 1, limit = 20, merchantId?: string) {
    const pg = this.normalizePagination(page, limit);
    const where: Prisma.MerchantBundleWhereInput = {
      isActive: true,
      merchant: { isEnabled: true },
      ...(merchantId?.trim() ? { merchantId: merchantId.trim() } : {}),
    };

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.merchantBundle.count({ where }),
      this.prisma.merchantBundle.findMany({
        where,
        include: this.merchantInclude,
        orderBy: [{ createdAt: 'desc' }],
        skip: pg.skip,
        take: pg.limit,
      }),
    ]);

    return this.pagedResponse(
      rows.map((r) => this.mapRow(r, r.merchant)),
      total,
      pg.page,
      pg.limit,
    );
  }

  async findOnePublic(bundleId: string) {
    const row = await this.prisma.merchantBundle.findFirst({
      where: {
        id: bundleId,
        isActive: true,
        merchant: { isEnabled: true },
      },
      include: this.merchantInclude,
    });
    if (!row) {
      throw new NotFoundException('Bundle not found');
    }
    return this.mapRow(row, row.merchant);
  }

  async listForMerchant(merchantId: string, page = 1, limit = 20) {
    await this.assertMerchantExists(merchantId);
    const pg = this.normalizePagination(page, limit);
    const where = { merchantId };

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.merchantBundle.count({ where }),
      this.prisma.merchantBundle.findMany({
        where,
        include: this.merchantInclude,
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
        skip: pg.skip,
        take: pg.limit,
      }),
    ]);

    return this.pagedResponse(
      rows.map((r) => this.mapRow(r, r.merchant)),
      total,
      pg.page,
      pg.limit,
    );
  }

  async findOneForMerchant(merchantId: string, bundleId: string) {
    const row = await this.prisma.merchantBundle.findFirst({
      where: { id: bundleId, merchantId },
      include: this.merchantInclude,
    });
    if (!row) {
      throw new NotFoundException('Bundle not found');
    }
    return this.mapRow(row, row.merchant);
  }

  async createForMerchant(
    merchantId: string,
    dto: CreateBundleMerchantDto,
    imageUrl: string,
  ) {
    await this.assertMerchantExists(merchantId);
    await this.assertMerchantBundleLimit(merchantId);

    const row = await this.prisma.merchantBundle.create({
      data: this.buildCreateData(dto, merchantId, imageUrl),
      include: this.merchantInclude,
    });

    return this.mapRow(row, row.merchant);
  }

  async updateForMerchant(
    merchantId: string,
    bundleId: string,
    dto: UpdateBundleMerchantDto,
    imageUrl?: string,
  ) {
    const existing = await this.prisma.merchantBundle.findFirst({
      where: { id: bundleId, merchantId },
    });
    if (!existing) {
      throw new NotFoundException('Bundle not found');
    }

    const row = await this.prisma.merchantBundle.update({
      where: { id: bundleId },
      data: this.buildUpdateData(dto, imageUrl),
      include: this.merchantInclude,
    });

    if (imageUrl !== undefined && imageUrl !== existing.imageUrl) {
      await this.deleteBundleImage(existing.imageUrl);
    }

    return this.mapRow(row, row.merchant);
  }

  async removeForMerchant(merchantId: string, bundleId: string) {
    const existing = await this.prisma.merchantBundle.findFirst({
      where: { id: bundleId, merchantId },
    });
    if (!existing) {
      throw new NotFoundException('Bundle not found');
    }

    await this.prisma.merchantBundle.delete({ where: { id: bundleId } });
    await this.deleteBundleImage(existing.imageUrl);

    return { message: 'Bundle deleted' };
  }

  async listAllAdmin(page = 1, limit = 20, merchantId?: string) {
    const pg = this.normalizePagination(page, limit);
    const where: Prisma.MerchantBundleWhereInput = merchantId?.trim()
      ? { merchantId: merchantId.trim() }
      : {};

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.merchantBundle.count({ where }),
      this.prisma.merchantBundle.findMany({
        where,
        include: this.merchantInclude,
        orderBy: [{ createdAt: 'desc' }],
        skip: pg.skip,
        take: pg.limit,
      }),
    ]);

    return this.pagedResponse(
      rows.map((r) => this.mapRow(r, r.merchant)),
      total,
      pg.page,
      pg.limit,
    );
  }

  async findOneAdmin(bundleId: string) {
    const row = await this.findBundleOrThrow(bundleId);
    return this.mapRow(row, row.merchant);
  }

  async createForAdmin(dto: CreateBundleAdminDto, imageUrl: string) {
    await this.assertMerchantExists(dto.merchantId);

    const row = await this.prisma.merchantBundle.create({
      data: this.buildCreateData(dto, dto.merchantId, imageUrl),
      include: this.merchantInclude,
    });

    return this.mapRow(row, row.merchant);
  }

  async updateForAdmin(
    bundleId: string,
    dto: UpdateBundleAdminDto,
    imageUrl?: string,
  ) {
    const existing = await this.findBundleOrThrow(bundleId);

    if (dto.merchantId !== undefined) {
      await this.assertMerchantExists(dto.merchantId);
    }

    const row = await this.prisma.merchantBundle.update({
      where: { id: bundleId },
      data: {
        ...this.buildUpdateData(dto, imageUrl),
        ...(dto.merchantId !== undefined
          ? { merchant: { connect: { id: dto.merchantId } } }
          : {}),
      },
      include: this.merchantInclude,
    });

    if (imageUrl !== undefined && imageUrl !== existing.imageUrl) {
      await this.deleteBundleImage(existing.imageUrl);
    }

    return this.mapRow(row, row.merchant);
  }

  async removeForAdmin(bundleId: string) {
    const existing = await this.findBundleOrThrow(bundleId);

    await this.prisma.merchantBundle.delete({ where: { id: bundleId } });
    await this.deleteBundleImage(existing.imageUrl);

    return { message: 'Bundle deleted' };
  }
}
