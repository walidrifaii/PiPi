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
import type { ProductOptionGroupView } from '../merchant/product-option.types';
import { ProductOptionGroupDto } from './dto/product-option.dto';
import {
  nameStartsWithFilter,
  normalizeNameSearchTerm,
} from '../common/name-search';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { MerchantOfferService } from '../merchant-offer/merchant-offer.service';
import { resolveStorefrontProductPricing } from '../merchant-offer/merchant-offer-pricing';

const OPTION_GROUPS_INCLUDE = {
  optionGroups: {
    orderBy: { sortOrder: 'asc' as const },
    include: {
      choices: { orderBy: { sortOrder: 'asc' as const } },
    },
  },
} as const;

@Injectable()
export class MerchantCatalogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly merchantOffers: MerchantOfferService,
  ) {}

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

  private mapOptionGroups(
    groups: Array<{
      id: string;
      name: string;
      nameAr: string | null;
      isRequired: boolean;
      minSelect: number;
      maxSelect: number;
      sortOrder: number;
      choices: Array<{
        id: string;
        name: string;
        nameAr: string | null;
        priceModifier: { toString(): string };
        sortOrder: number;
        isActive: boolean;
      }>;
    }>,
    activeOnly = false,
  ): ProductOptionGroupView[] {
    return groups.map((g) => ({
      id: g.id,
      name: g.name,
      nameAr: g.nameAr,
      isRequired: g.isRequired,
      minSelect: g.minSelect,
      maxSelect: g.maxSelect,
      sortOrder: g.sortOrder,
      choices: g.choices
        .filter((c) => !activeOnly || c.isActive)
        .map((c) => ({
          id: c.id,
          name: c.name,
          nameAr: c.nameAr,
          priceModifier: Number(c.priceModifier),
          sortOrder: c.sortOrder,
          isActive: c.isActive,
        })),
    }));
  }

  private assertOptionGroupsValid(groups?: ProductOptionGroupDto[]): void {
    if (!groups?.length) {
      return;
    }
    for (const g of groups) {
      const minSelect = g.minSelect ?? 1;
      const maxSelect = g.maxSelect ?? 1;
      if (maxSelect < minSelect) {
        throw new BadRequestException(
          `Option group "${g.name}": maxSelect cannot be less than minSelect`,
        );
      }
      if ((g.isRequired ?? true) && minSelect < 1) {
        throw new BadRequestException(
          `Option group "${g.name}": required groups need minSelect >= 1`,
        );
      }
      if (!g.choices?.length) {
        throw new BadRequestException(
          `Option group "${g.name}" must have at least one choice`,
        );
      }
    }
  }

  private buildOptionGroupsCreate(groups: ProductOptionGroupDto[]) {
    return groups.map((g, gi) => ({
      name: g.name,
      nameAr: g.nameAr,
      isRequired: g.isRequired ?? true,
      minSelect: g.minSelect ?? 1,
      maxSelect: g.maxSelect ?? 1,
      sortOrder: g.sortOrder ?? gi,
      choices: {
        create: g.choices.map((c, ci) => ({
          name: c.name,
          nameAr: c.nameAr,
          priceModifier: new Prisma.Decimal(c.priceModifier ?? 0),
          sortOrder: c.sortOrder ?? ci,
          isActive: c.isActive ?? true,
        })),
      },
    }));
  }

  private async replaceProductOptionGroups(
    tx: Prisma.TransactionClient,
    productId: string,
    groups: ProductOptionGroupDto[],
  ): Promise<void> {
    await tx.productOptionGroup.deleteMany({ where: { productId } });
    if (groups.length === 0) {
      return;
    }
    for (const data of this.buildOptionGroupsCreate(groups)) {
      await tx.productOptionGroup.create({
        data: { productId, ...data },
      });
    }
  }

  private attachProductPricing<T extends { price: unknown; discountPrice: unknown }>(
    row: T & { optionGroups?: Parameters<MerchantCatalogService['mapOptionGroups']>[0] },
    activeOnly = false,
    /** When set (including null), applies live merchant promo to storefront pricing. */
    storefrontOfferPercent?: number | null,
  ) {
    const price = Number(row.price);
    const storedDiscount =
      row.discountPrice !== null ? Number(row.discountPrice) : null;
    const optionGroups = row.optionGroups
      ? this.mapOptionGroups(row.optionGroups, activeOnly)
      : [];

    if (storefrontOfferPercent !== undefined) {
      const pricing = resolveStorefrontProductPricing(
        price,
        storedDiscount,
        storefrontOfferPercent,
      );
      return {
        ...row,
        price: pricing.price,
        discountPrice: pricing.discountPrice,
        hasDiscount: pricing.hasDiscount,
        effectivePrice: pricing.effectivePrice,
        merchantOfferPercent: pricing.merchantOfferPercent,
        optionGroups,
      };
    }

    const discountPrice = storedDiscount;
    return {
      ...row,
      price,
      discountPrice,
      ...this.discountPresentation(price, discountPrice),
      optionGroups,
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
        ...OPTION_GROUPS_INCLUDE,
      },
      orderBy: [{ updatedAt: 'desc' }],
    });

    return rows.map((p) => {
      const priced = this.attachProductPricing(p, true);
      return {
        id: p.id,
        name: p.name,
        nameAr: p.nameAr,
        description: p.description,
        descriptionAr: p.descriptionAr,
        price: priced.price,
        discountPrice: priced.discountPrice,
        hasDiscount: priced.hasDiscount,
        effectivePrice: priced.effectivePrice,
        category: p.category.name,
        categoryAr: p.category.nameAr,
        images: this.collectImageUrls(
          p.imageUrl,
          p.images.map((i) => i.url),
        ),
        optionGroups: priced.optionGroups,
      };
    });
  }

  /** Public storefront: product details by id (guest or logged-in customer). */
  async getProductForStorefront(
    productId: string,
    activeProductsOnly = false,
  ) {
    const row = await this.prisma.product.findUnique({
      where: { id: productId },
      include: {
        images: { orderBy: { sortOrder: 'asc' } },
        ...OPTION_GROUPS_INCLUDE,
        category: {
          select: {
            id: true,
            name: true,
            nameAr: true,
            description: true,
            descriptionAr: true,
            merchant: {
              select: {
                id: true,
                name: true,
                imageUrl: true,
                isActive: true,
                deliveryTime: {
                  select: { minMinutes: true, maxMinutes: true },
                },
              },
            },
          },
        },
      },
    });

    if (!row || !row.category.merchant.isActive) {
      throw new NotFoundException('Product not found');
    }
    if (activeProductsOnly && !row.isActive) {
      throw new NotFoundException('Product not found');
    }

    const offerPercent =
      await this.merchantOffers.getLiveOfferPercentForMerchant(
        row.category.merchant.id,
      );
    const priced = this.attachProductPricing(row, true, offerPercent);
    const merchant = row.category.merchant;

    return {
      id: row.id,
      isActive: row.isActive,
      categoryId: row.categoryId,
      name: row.name,
      nameAr: row.nameAr,
      description: row.description,
      descriptionAr: row.descriptionAr,
      price: priced.price,
      discountPrice: priced.discountPrice,
      imageUrl: row.imageUrl,
      hasDiscount: priced.hasDiscount,
      effectivePrice: priced.effectivePrice,
      merchantOfferPercent: offerPercent,
      optionGroups: priced.optionGroups,
      images: row.images,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      category: {
        id: row.category.id,
        name: row.category.name,
        nameAr: row.category.nameAr,
        description: row.category.description,
        descriptionAr: row.category.descriptionAr,
      },
      merchant: {
        id: merchant.id,
        name: merchant.name,
        logoUrl: merchant.imageUrl,
        deliveryTime: merchant.deliveryTime
          ? {
              minMinutes: merchant.deliveryTime.minMinutes,
              maxMinutes: merchant.deliveryTime.maxMinutes,
            }
          : null,
      },
    };
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
    activeProductsOnly = false,
  ) {
    await this.assertMerchantBrowsable(merchantId);
    return this.fetchProductsPaged(
      merchantId,
      categoryId,
      page,
      limit,
      true,
      activeProductsOnly,
    );
  }

  async listProducts(
    merchantId: string,
    categoryId: string,
    page = 1,
    limit = 20,
  ) {
    await this.assertMerchantExists(merchantId);
    return this.fetchProductsPaged(merchantId, categoryId, page, limit, false);
  }

  private async fetchProductsPaged(
    merchantId: string,
    categoryId: string,
    page: number,
    limit: number,
    activeOptionsOnly: boolean,
    activeProductsOnly = false,
  ) {
    const category = await this.prisma.merchantCategory.findFirst({
      where: { id: categoryId, merchantId },
    });
    if (!category) {
      throw new NotFoundException('Category not found');
    }
    const pg = this.normalizePagination(page, limit);
    const where = {
      categoryId,
      ...(activeProductsOnly ? { isActive: true } : {}),
    };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({
        where,
        include: {
          images: { orderBy: { sortOrder: 'asc' } },
          ...OPTION_GROUPS_INCLUDE,
        },
        orderBy: [{ name: 'asc' }],
        skip: pg.skip,
        take: pg.limit,
      }),
    ]);
    const offerPercent = activeOptionsOnly
      ? await this.merchantOffers.getLiveOfferPercentForMerchant(merchantId)
      : undefined;
    const items = rows.map((p) =>
      this.attachProductPricing(
        p,
        activeOptionsOnly,
        activeOptionsOnly ? offerPercent : undefined,
      ),
    );
    return this.pagedResponse(items, total, pg.page, pg.limit);
  }

  async listAllProductsForStorefront(
    merchantId: string,
    categoryId?: string,
    page = 1,
    limit = 20,
    activeProductsOnly = false,
  ) {
    await this.assertMerchantBrowsable(merchantId);
    return this.fetchAllProductsPaged(
      merchantId,
      categoryId,
      page,
      limit,
      true,
      activeProductsOnly,
    );
  }

  async listAllProducts(
    merchantId: string,
    categoryId?: string,
    page = 1,
    limit = 20,
  ) {
    await this.assertMerchantExists(merchantId);
    return this.fetchAllProductsPaged(
      merchantId,
      categoryId,
      page,
      limit,
      false,
    );
  }

  private async fetchAllProductsPaged(
    merchantId: string,
    categoryId: string | undefined,
    page: number,
    limit: number,
    activeOptionsOnly: boolean,
    activeProductsOnly = false,
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
      ...(activeProductsOnly ? { isActive: true } : {}),
    };
    const pg = this.normalizePagination(page, limit);
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({
        where,
        include: {
          category: { select: { id: true, name: true, nameAr: true } },
          images: { orderBy: { sortOrder: 'asc' } },
          ...OPTION_GROUPS_INCLUDE,
        },
        orderBy: [{ updatedAt: 'desc' }],
        skip: pg.skip,
        take: pg.limit,
      }),
    ]);
    const offerPercent = activeOptionsOnly
      ? await this.merchantOffers.getLiveOfferPercentForMerchant(merchantId)
      : undefined;
    const items = rows.map((p) => ({
      ...this.attachProductPricing(
        p,
        activeOptionsOnly,
        activeOptionsOnly ? offerPercent : undefined,
      ),
      category: p.category,
    }));
    return this.pagedResponse(items, total, pg.page, pg.limit);
  }

  /**
   * Discounted products from active merchants in the user's service area
   * (`discount_price` set and strictly below `price`). Pagination is applied in the database.
   */
  async listDiscountedProductsAcrossMerchants(
    page = 1,
    limit = 20,
    scopeMerchantIds: string[] = [],
    activeProductsOnly = false,
  ) {
    const pg = this.normalizePagination(page, limit);

    if (scopeMerchantIds.length === 0) {
      return this.pagedResponse([], 0, pg.page, pg.limit);
    }

    const openIds = await this.merchantIdsOpenForBusiness();
    const scopeSet = new Set(scopeMerchantIds);
    const allowedIds = openIds.filter((id) => scopeSet.has(id));
    if (allowedIds.length === 0) {
      return this.pagedResponse([], 0, pg.page, pg.limit);
    }

    const openIdList = Prisma.join(
      allowedIds.map((id) => Prisma.sql`${id}::uuid`),
      ', ',
    );

    const activeProductSql = activeProductsOnly
      ? Prisma.sql`AND p.is_active = true`
      : Prisma.empty;

    const countRows = await this.prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*)::bigint AS count
      FROM products p
      INNER JOIN merchant_categories mc ON mc.id = p.category_id
      INNER JOIN merchants m ON m.id = mc.merchant_id
      WHERE p.discount_price IS NOT NULL
        AND p.discount_price < p.price
        AND m.is_active = true
        AND m.id IN (${openIdList})
        ${activeProductSql}
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
        ${activeProductSql}
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
        ...OPTION_GROUPS_INCLUDE,
      },
    });
    const byId = new Map(rows.map((p) => [p.id, p]));
    const ordered = ids
      .map((id) => byId.get(id))
      .filter((row): row is (typeof rows)[number] => row !== undefined);

    const items = ordered.map((p) => ({
      ...this.attachProductPricing(p, true),
      category: {
        id: p.category.id,
        name: p.category.name,
        nameAr: p.category.nameAr,
      },
      merchant: {
        id: p.category.merchant.id,
        name: p.category.merchant.name,
      },
    }));

    return this.pagedResponse(items, total, pg.page, pg.limit);
  }

  /**
   * Public storefront: search products by name (English or Arabic) across active
   * merchants in the user's service area. Guest or logged-in customer; no auth required.
   */
  async searchProductsByName(
    name: string,
    page = 1,
    limit = 20,
    filters: {
      merchantTypeCode?: string;
      /** Merchants whose GPS lies inside the polygon that contains the user. */
      scopeMerchantIds: string[];
      activeProductsOnly?: boolean;
    },
  ) {
    const term = normalizeNameSearchTerm(name);

    const merchantTypeCode = filters.merchantTypeCode;
    if (merchantTypeCode) {
      const code = merchantTypeCode.trim().toUpperCase();
      const exists = await this.prisma.merchantType.findUnique({
        where: { code },
        select: { id: true },
      });
      if (!exists) {
        throw new BadRequestException('Invalid merchantType filter');
      }
    }

    const pg = this.normalizePagination(page, limit);

    if (filters.scopeMerchantIds.length === 0) {
      return this.pagedResponse([], 0, pg.page, pg.limit);
    }

    const where: Prisma.ProductWhereInput = {
      OR: [
        { name: nameStartsWithFilter(term) },
        { nameAr: nameStartsWithFilter(term) },
      ],
      ...(filters.activeProductsOnly ? { isActive: true } : {}),
      category: {
        merchant: {
          id: { in: filters.scopeMerchantIds },
          isActive: true,
          ...(merchantTypeCode
            ? {
                merchantType: {
                  code: merchantTypeCode.trim().toUpperCase(),
                },
              }
            : {}),
        },
      },
    };

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({
        where,
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
          ...OPTION_GROUPS_INCLUDE,
        },
        orderBy: [{ name: 'asc' }],
        skip: pg.skip,
        take: pg.limit,
      }),
    ]);

    const items = rows.map((p) => ({
      ...this.attachProductPricing(p, true),
      category: {
        id: p.category.id,
        name: p.category.name,
        nameAr: p.category.nameAr,
      },
      merchant: {
        id: p.category.merchant.id,
        name: p.category.merchant.name,
      },
    }));

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
    this.assertOptionGroupsValid(dto.optionGroups);

    const created = await this.prisma.product.create({
      data: {
        categoryId,
        name: dto.name,
        description: dto.description,
        nameAr: dto.nameAr,
        descriptionAr: dto.descriptionAr,
        price: new Prisma.Decimal(dto.price),
        isActive: dto.isActive ?? true,
        discountPrice:
          dto.discountPrice !== undefined
            ? new Prisma.Decimal(Number(dto.discountPrice))
            : undefined,
        imageUrl: mainImageUrl,
        images: {
          create: galleryUrls.map((url, sortOrder) => ({ url, sortOrder })),
        },
        ...(dto.optionGroups?.length
          ? {
              optionGroups: {
                create: this.buildOptionGroupsCreate(dto.optionGroups),
              },
            }
          : {}),
      },
      include: {
        images: { orderBy: { sortOrder: 'asc' } },
        ...OPTION_GROUPS_INCLUDE,
      },
    });
    return this.attachProductPricing(created, false);
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
    if (dto.optionGroups !== undefined) {
      this.assertOptionGroupsValid(dto.optionGroups);
    }

    const { extraImageUrls, imageUrl, optionGroups, ...rest } = dto;

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

      if (optionGroups !== undefined) {
        await this.replaceProductOptionGroups(tx, productId, optionGroups);
      }

      const updated = await tx.product.update({
        where: { id: productId },
        data: {
          name: rest.name,
          description: rest.description,
          nameAr: rest.nameAr,
          descriptionAr: rest.descriptionAr,
          isActive: rest.isActive,
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
        include: {
          images: { orderBy: { sortOrder: 'asc' } },
          ...OPTION_GROUPS_INCLUDE,
        },
      });
      return this.attachProductPricing(updated, false);
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
