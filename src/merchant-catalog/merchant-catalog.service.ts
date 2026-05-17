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
import { UnifiedProduct } from '../merchant/catalog.types';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Injectable()
export class MerchantCatalogService {
  constructor(private readonly prisma: PrismaService) {}

  private normalizePagination(page: number, limit: number) {
    const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
    const safeLimit =
      Number.isFinite(limit) && limit > 0
        ? Math.min(Math.floor(limit), 100)
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

  /** Merchants that are manually OPEN and inside working hours (if configured). */
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

  /** Sale is active only when discount is strictly below list price */
  private discountPresentation(price: number, discountPrice: number | null) {
    const hasDiscount =
      discountPrice !== null && Number(discountPrice) < Number(price);
    return {
      hasDiscount,
      effectivePrice: hasDiscount ? Number(discountPrice) : Number(price),
    };
  }

  async getUnifiedProductsForMerchant(
    merchantId: string,
  ): Promise<UnifiedProduct[]> {
    await this.assertMerchantActive(merchantId);

    const rows = await this.prisma.product.findMany({
      where: { category: { merchantId } },
      include: {
        category: { select: { name: true, nameAr: true } },
        images: { orderBy: { sortOrder: 'asc' } },
      },
      orderBy: [{ updatedAt: 'desc' }],
    });

    return rows.map((p) => {
      const price = Number(p.price);
      const discountPrice =
        p.discountPrice !== null ? Number(p.discountPrice) : null;
      return {
        id: p.id,
        name: p.name,
        nameAr: p.nameAr,
        description: p.description,
        descriptionAr: p.descriptionAr,
        price,
        discountPrice,
        ...this.discountPresentation(price, discountPrice),
        category: p.category.name,
        categoryAr: p.category.nameAr,
        images: this.collectImageUrls(
          p.imageUrl,
          p.images.map((i) => i.url),
        ),
      };
    });
  }

  /** Public storefront: guest or customer; store may be CLOSED but must exist and be active. */
  async listCategoriesForStorefront(merchantId: string, page = 1, limit = 20) {
    await this.assertMerchantBrowsable(merchantId);
    return this.fetchCategoriesPaged(merchantId, page, limit);
  }

  async listCategories(merchantId: string, page = 1, limit = 20) {
    await this.assertMerchantExists(merchantId);
    return this.fetchCategoriesPaged(merchantId, page, limit);
  }

  private async fetchCategoriesPaged(
    merchantId: string,
    page: number,
    limit: number,
  ) {
    const pg = this.normalizePagination(page, limit);
    const where = { merchantId };
    const [total, items] = await this.prisma.$transaction([
      this.prisma.merchantCategory.count({ where }),
      this.prisma.merchantCategory.findMany({
        where,
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        include: { _count: { select: { products: true } } },
        skip: pg.skip,
        take: pg.limit,
      }),
    ]);
    return this.pagedResponse(items, total, pg.page, pg.limit);
  }

  async createCategory(
    merchantId: string,
    dto: CreateCategoryDto,
    imageUrl?: string,
  ) {
    await this.assertMerchantExists(merchantId);
    return this.prisma.merchantCategory.create({
      data: {
        merchantId,
        name: dto.name,
        description: dto.description,
        nameAr: dto.nameAr,
        descriptionAr: dto.descriptionAr,
        imageUrl,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
  }

  async updateCategory(
    merchantId: string,
    categoryId: string,
    dto: UpdateCategoryDto,
  ) {
    await this.assertMerchantExists(merchantId);
    const existing = await this.prisma.merchantCategory.findFirst({
      where: { id: categoryId, merchantId },
    });
    if (!existing) {
      throw new NotFoundException('Category not found');
    }
    return this.prisma.merchantCategory.update({
      where: { id: categoryId },
      data: {
        name: dto.name,
        description: dto.description,
        nameAr: dto.nameAr,
        descriptionAr: dto.descriptionAr,
        sortOrder: dto.sortOrder,
        ...(dto.imageUrl !== undefined ? { imageUrl: dto.imageUrl } : {}),
      },
    });
  }

  async deleteCategory(merchantId: string, categoryId: string) {
    await this.assertMerchantExists(merchantId);
    const existing = await this.prisma.merchantCategory.findFirst({
      where: { id: categoryId, merchantId },
    });
    if (!existing) {
      throw new NotFoundException('Category not found');
    }
    await this.prisma.merchantCategory.delete({ where: { id: categoryId } });
    return { message: 'Category deleted' };
  }

  async listProductsForStorefront(
    merchantId: string,
    categoryId: string,
    page = 1,
    limit = 20,
  ) {
    await this.assertMerchantBrowsable(merchantId);
    return this.fetchProductsPaged(merchantId, categoryId, page, limit);
  }

  async listProducts(
    merchantId: string,
    categoryId: string,
    page = 1,
    limit = 20,
  ) {
    await this.assertMerchantExists(merchantId);
    return this.fetchProductsPaged(merchantId, categoryId, page, limit);
  }

  private async fetchProductsPaged(
    merchantId: string,
    categoryId: string,
    page: number,
    limit: number,
  ) {
    const category = await this.prisma.merchantCategory.findFirst({
      where: { id: categoryId, merchantId },
    });
    if (!category) {
      throw new NotFoundException('Category not found');
    }
    const pg = this.normalizePagination(page, limit);
    const where = { categoryId };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({
        where,
        include: { images: { orderBy: { sortOrder: 'asc' } } },
        orderBy: [{ name: 'asc' }],
        skip: pg.skip,
        take: pg.limit,
      }),
    ]);
    const items = rows.map((p) => {
      const price = Number(p.price);
      const discountPrice =
        p.discountPrice !== null ? Number(p.discountPrice) : null;
      return {
        ...p,
        price,
        discountPrice,
        ...this.discountPresentation(price, discountPrice),
      };
    });
    return this.pagedResponse(items, total, pg.page, pg.limit);
  }

  async listAllProductsForStorefront(
    merchantId: string,
    categoryId?: string,
    page = 1,
    limit = 20,
  ) {
    await this.assertMerchantBrowsable(merchantId);
    return this.fetchAllProductsPaged(merchantId, categoryId, page, limit);
  }

  async listAllProducts(
    merchantId: string,
    categoryId?: string,
    page = 1,
    limit = 20,
  ) {
    await this.assertMerchantExists(merchantId);
    return this.fetchAllProductsPaged(merchantId, categoryId, page, limit);
  }

  private async fetchAllProductsPaged(
    merchantId: string,
    categoryId: string | undefined,
    page: number,
    limit: number,
  ) {
    if (categoryId !== undefined && categoryId !== '') {
      const category = await this.prisma.merchantCategory.findFirst({
        where: { id: categoryId, merchantId },
      });
      if (!category) {
        throw new NotFoundException('Category not found');
      }
    }

    const where = {
      category: { merchantId },
      ...(categoryId !== undefined && categoryId !== '' ? { categoryId } : {}),
    };
    const pg = this.normalizePagination(page, limit);
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({
        where,
        include: {
          category: { select: { id: true, name: true, nameAr: true } },
          images: { orderBy: { sortOrder: 'asc' } },
        },
        orderBy: [{ updatedAt: 'desc' }],
        skip: pg.skip,
        take: pg.limit,
      }),
    ]);
    const items = rows.map((p) => {
      const price = Number(p.price);
      const discountPrice =
        p.discountPrice !== null ? Number(p.discountPrice) : null;
      return {
        ...p,
        price,
        discountPrice,
        ...this.discountPresentation(price, discountPrice),
        category: p.category,
      };
    });
    return this.pagedResponse(items, total, pg.page, pg.limit);
  }

  /**
   * All products on sale across every active merchant (`discount_price` set and
   * strictly below `price`). Pagination is applied in the database.
   */
  async listDiscountedProductsAcrossMerchants(page = 1, limit = 20) {
    const pg = this.normalizePagination(page, limit);

    const openIds = await this.merchantIdsOpenForBusiness();
    if (openIds.length === 0) {
      return this.pagedResponse([], 0, pg.page, pg.limit);
    }

    const openIdList = Prisma.join(
      openIds.map((id) => Prisma.sql`${id}::uuid`),
      ', ',
    );

    const countRows = await this.prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*)::bigint AS count
      FROM products p
      INNER JOIN merchant_categories mc ON mc.id = p.category_id
      INNER JOIN merchants m ON m.id = mc.merchant_id
      WHERE p.discount_price IS NOT NULL
        AND p.discount_price < p.price
        AND m.is_active = true
        AND m.id IN (${openIdList})
    `;
    const total = Number(countRows[0]?.count ?? 0);

    const idRows = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT p.id
      FROM products p
      INNER JOIN merchant_categories mc ON mc.id = p.category_id
      INNER JOIN merchants m ON m.id = mc.merchant_id
      WHERE p.discount_price IS NOT NULL
        AND p.discount_price < p.price
        AND m.is_active = true
        AND m.id IN (${openIdList})
      ORDER BY p.updated_at DESC
      LIMIT ${pg.limit}
      OFFSET ${pg.skip}
    `;

    const ids = idRows.map((r) => r.id);
    if (ids.length === 0) {
      return this.pagedResponse([], total, pg.page, pg.limit);
    }

    const rows = await this.prisma.product.findMany({
      where: { id: { in: ids } },
      include: {
        category: {
          select: {
            id: true,
            name: true,
            nameAr: true,
            merchantId: true,
            merchant: { select: { id: true, name: true } },
          },
        },
        images: { orderBy: { sortOrder: 'asc' } },
      },
    });
    const byId = new Map(rows.map((p) => [p.id, p]));
    const ordered = ids
      .map((id) => byId.get(id))
      .filter((row): row is (typeof rows)[number] => row !== undefined);

    const items = ordered.map((p) => {
      const price = Number(p.price);
      const discountPrice =
        p.discountPrice !== null ? Number(p.discountPrice) : null;
      return {
        ...p,
        price,
        discountPrice,
        ...this.discountPresentation(price, discountPrice),
        category: {
          id: p.category.id,
          name: p.category.name,
          nameAr: p.category.nameAr,
        },
        merchant: {
          id: p.category.merchant.id,
          name: p.category.merchant.name,
        },
      };
    });

    return this.pagedResponse(items, total, pg.page, pg.limit);
  }

  async createProduct(
    merchantId: string,
    categoryId: string,
    dto: CreateProductDto,
    mainImageUrl?: string,
    galleryUrls: string[] = [],
  ) {
    await this.assertMerchantExists(merchantId);
    const category = await this.prisma.merchantCategory.findFirst({
      where: { id: categoryId, merchantId },
    });
    if (!category) {
      throw new NotFoundException('Category not found');
    }

    this.assertDiscountNotAbovePrice(dto.price, dto.discountPrice);

    const created = await this.prisma.product.create({
      data: {
        categoryId,
        name: dto.name,
        description: dto.description,
        nameAr: dto.nameAr,
        descriptionAr: dto.descriptionAr,
        price: new Prisma.Decimal(dto.price),
        discountPrice:
          dto.discountPrice !== undefined
            ? new Prisma.Decimal(Number(dto.discountPrice))
            : undefined,
        imageUrl: mainImageUrl,
        images: {
          create: galleryUrls.map((url, sortOrder) => ({ url, sortOrder })),
        },
      },
      include: { images: { orderBy: { sortOrder: 'asc' } } },
    });
    const price = Number(created.price);
    const discountPrice =
      created.discountPrice !== null ? Number(created.discountPrice) : null;
    return {
      ...created,
      price,
      discountPrice,
      ...this.discountPresentation(price, discountPrice),
    };
  }

  async updateProduct(
    merchantId: string,
    productId: string,
    dto: UpdateProductDto,
  ) {
    await this.assertMerchantExists(merchantId);
    const product = await this.prisma.product.findFirst({
      where: {
        id: productId,
        category: { merchantId },
      },
    });
    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const effectivePrice =
      dto.price !== undefined ? Number(dto.price) : Number(product.price);
    let effectiveDiscount: number | null;
    if (dto.discountPrice !== undefined) {
      effectiveDiscount =
        dto.discountPrice === null ? null : Number(dto.discountPrice);
    } else {
      effectiveDiscount =
        product.discountPrice !== null ? Number(product.discountPrice) : null;
    }
    this.assertDiscountNotAbovePrice(effectivePrice, effectiveDiscount);

    const { extraImageUrls, imageUrl, ...rest } = dto;

    return this.prisma.$transaction(async (tx) => {
      if (extraImageUrls !== undefined) {
        await tx.productImage.deleteMany({ where: { productId } });
        if (extraImageUrls.length > 0) {
          await tx.productImage.createMany({
            data: extraImageUrls.map((url, sortOrder) => ({
              productId,
              url,
              sortOrder,
            })),
          });
        }
      }

      const updated = await tx.product.update({
        where: { id: productId },
        data: {
          name: rest.name,
          description: rest.description,
          nameAr: rest.nameAr,
          descriptionAr: rest.descriptionAr,
          price:
            rest.price !== undefined
              ? new Prisma.Decimal(rest.price)
              : undefined,
          discountPrice:
            rest.discountPrice !== undefined
              ? new Prisma.Decimal(Number(rest.discountPrice))
              : undefined,
          ...(imageUrl !== undefined ? { imageUrl } : {}),
        },
        include: { images: { orderBy: { sortOrder: 'asc' } } },
      });
      const price = Number(updated.price);
      const discountPrice =
        updated.discountPrice !== null ? Number(updated.discountPrice) : null;
      return {
        ...updated,
        price,
        discountPrice,
        ...this.discountPresentation(price, discountPrice),
      };
    });
  }

  async deleteProduct(merchantId: string, productId: string) {
    await this.assertMerchantExists(merchantId);
    const product = await this.prisma.product.findFirst({
      where: {
        id: productId,
        category: { merchantId },
      },
    });
    if (!product) {
      throw new NotFoundException('Product not found');
    }
    await this.prisma.product.delete({ where: { id: productId } });
    return { message: 'Product deleted' };
  }

  private assertDiscountNotAbovePrice(
    price: number,
    discountPrice?: number | null,
  ): void {
    if (discountPrice === undefined || discountPrice === null) {
      return;
    }
    if (Number(discountPrice) > Number(price)) {
      throw new BadRequestException(
        'discountPrice cannot be greater than price',
      );
    }
  }

  private collectImageUrls(main: string | null, extras: string[]): string[] {
    const out: string[] = [];
    if (main) {
      out.push(main);
    }
    for (const u of extras) {
      if (u && !out.includes(u)) {
        out.push(u);
      }
    }
    return out;
  }

  private async assertMerchantActive(merchantId: string): Promise<void> {
    const merchant = await this.prisma.merchant.findUnique({
      where: { id: merchantId },
      select: {
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
    if (!merchant?.isActive) {
      throw new NotFoundException('Merchant not found or inactive');
    }
    const week = workingIntervalsToWeek(merchant.workingIntervals);
    const weekOrNull = week.days.length > 0 ? week : null;
    const open = computeMerchantOpenNow({
      isActive: merchant.isActive,
      useWorkingHours: merchant.useWorkingHours,
      timezone: merchant.timezone,
      week: weekOrNull,
    });
    if (!open) {
      throw new NotFoundException('Merchant not found or inactive');
    }
  }

  private async assertMerchantExists(merchantId: string): Promise<void> {
    const merchant = await this.prisma.merchant.findUnique({
      where: { id: merchantId },
      select: { id: true },
    });
    if (!merchant) {
      throw new NotFoundException('Merchant not found');
    }
  }

  /** Store exists and is not permanently deactivated (hours may still show CLOSED). */
  private async assertMerchantBrowsable(merchantId: string): Promise<void> {
    const merchant = await this.prisma.merchant.findUnique({
      where: { id: merchantId },
      select: { isActive: true },
    });
    if (!merchant?.isActive) {
      throw new NotFoundException('Merchant not found or inactive');
    }
  }
}
