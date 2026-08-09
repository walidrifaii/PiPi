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
  buildNameSearchWhere,
  normalizeNameSearchTerm,
} from '../common/name-search';
import { S3Service } from '../common/s3.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { MerchantOfferService } from '../merchant-offer/merchant-offer.service';
import { resolveStorefrontProductPricing } from '../merchant-offer/merchant-offer-pricing';
import {
  localizeCategory,
  localizeProduct,
  type I18nOptions,
  withLocaleMeta,
  withLocaleValue,
} from '../common/i18n';

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
    private readonly s3: S3Service,
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

  /**
   * Storefront categories: load every page internally when a full list is needed.
   * Product storefront endpoints use real DB pagination via fetch*Paged.
   */
  private async collectAllStorefrontPages<T>(
    fetchPage: (
      page: number,
      limit: number,
    ) => Promise<{
      items: T[];
      pagination: { total: number; totalPages: number };
    }>,
    pageSize = 100,
  ) {
    let currentPage = 1;
    const allItems: T[] = [];
    let total = 0;

    while (true) {
      const result = await fetchPage(currentPage, pageSize);
      allItems.push(...result.items);
      total = result.pagination.total;
      if (currentPage >= result.pagination.totalPages) {
        break;
      }
      currentPage++;
    }

    return {
      items: allItems,
      pagination: {
        page: 1,
        limit: allItems.length || pageSize,
        pageTotal: allItems.length,
        total,
        totalPages: 1,
      },
    };
  }

  /** Optional substring match on product name; locale selects Arabic or English field. */
  private buildProductNameWhereClause(
    name?: string,
    locale?: I18nOptions['locale'],
  ): Prisma.ProductWhereInput | undefined {
    const trimmed = name?.trim();
    if (!trimmed) {
      return undefined;
    }
    const term = normalizeNameSearchTerm(trimmed);
    return buildNameSearchWhere(term, locale);
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

  /** Storefront list/card: expose hasOptions only, omit option payload. */
  private toStorefrontProductListItem<
    T extends { optionGroups: ProductOptionGroupView[]; hasOptions: boolean },
  >(item: T): Omit<T, 'optionGroups'> {
    const { optionGroups: _optionGroups, ...rest } = item;
    return rest;
  }

  /** Storefront detail: include optionGroups only when hasOptions is true. */
  private toStorefrontProductDetail<T extends Record<string, unknown>>(
    item: T & { optionGroups: ProductOptionGroupView[]; hasOptions: boolean },
  ): Omit<T, 'optionGroups' | 'hasOptions'> & {
    hasOptions: boolean;
    optionGroups?: ProductOptionGroupView[];
  } {
    const { optionGroups, hasOptions, ...rest } = item;
    if (hasOptions) {
      return { ...rest, hasOptions, optionGroups };
    }
    return { ...rest, hasOptions };
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

  private attachProductPricing<T extends { price: unknown }>(
    row: T & { optionGroups?: Parameters<MerchantCatalogService['mapOptionGroups']>[0] },
    activeOnly = false,
    /** When set (including null), applies live merchant promo to storefront pricing. */
    storefrontOfferPercent?: number | null,
  ) {
    const price = Number(row.price);
    const optionGroups = row.optionGroups
      ? this.mapOptionGroups(row.optionGroups, activeOnly).filter(
          (g) => g.choices.length > 0,
        )
      : [];
    const hasOptions = optionGroups.length > 0;

    if (storefrontOfferPercent !== undefined) {
      const pricing = resolveStorefrontProductPricing(
        price,
        storefrontOfferPercent,
      );
      return {
        ...row,
        price: pricing.price,
        discountPrice: pricing.discountPrice,
        hasDiscount: pricing.hasDiscount,
        effectivePrice: pricing.effectivePrice,
        merchantOfferPercent: pricing.merchantOfferPercent,
        hasOptions,
        optionGroups,
      };
    }

    return {
      ...row,
      price,
      discountPrice: null,
      ...this.discountPresentation(price, null),
      hasOptions,
      optionGroups,
    };
  }

  private localizePagedProducts<T extends Record<string, unknown>>(
    response: {
      items: T[];
      pagination: {
        page: number;
        limit: number;
        pageTotal: number;
        total: number;
        totalPages: number;
      };
    },
    i18n?: I18nOptions,
  ) {
    return withLocaleMeta(
      {
        ...response,
        items: response.items.map((item) =>
          localizeProduct(item as unknown as Parameters<typeof localizeProduct>[0], i18n),
        ),
      },
      i18n,
    );
  }

  private localizePagedCategories<T extends Record<string, unknown>>(
    response: {
      items: T[];
      pagination: {
        page: number;
        limit: number;
        pageTotal: number;
        total: number;
        totalPages: number;
      };
    },
    i18n?: I18nOptions,
  ) {
    return withLocaleMeta(
      {
        ...response,
        items: response.items.map((item) =>
          localizeCategory(item as unknown as Parameters<typeof localizeCategory>[0], i18n),
        ),
      },
      i18n,
    );
  }

  async getUnifiedProductsForMerchant(
    merchantId: string,
    i18n?: I18nOptions,
  ): Promise<UnifiedProduct[]> {
    await this.assertMerchantBrowsable(merchantId);

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
      return localizeProduct(
        {
          id: p.id,
          name: p.name,
          nameAr: p.nameAr,
          description: p.description,
          descriptionAr: p.descriptionAr,
          price: priced.price,
          discountPrice: priced.discountPrice,
          hasDiscount: priced.hasDiscount,
          effectivePrice: priced.effectivePrice,
          hasOptions: priced.hasOptions,
          category: p.category.name,
          categoryAr: p.category.nameAr,
          images: this.collectImageUrls(
            p.imageUrl,
            p.images.map((i) => i.url),
          ),
        },
        i18n,
      );
    });
  }

  /** Public storefront: product details by id (guest or logged-in customer).
   * Always returns bilingual fields (`name` + `nameAr`, etc.) so clients can show both languages.
   */
  async getProductForStorefront(
    productId: string,
    activeProductsOnly = false,
    _i18n?: I18nOptions,
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
                nameAr: true,
                imageUrl: true,
                isEnabled: true,
                deliveryTime: {
                  select: { minMinutes: true, maxMinutes: true },
                },
              },
            },
          },
        },
      },
    });

    if (!row || !row.category.merchant.isEnabled) {
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

    return this.toStorefrontProductDetail({
      id: row.id,
      isActive: row.isActive,
      categoryId: row.categoryId,
      name: row.name,
      nameAr: row.nameAr ?? null,
      description: row.description ?? null,
      descriptionAr: row.descriptionAr ?? null,
      price: priced.price,
      discountPrice: priced.discountPrice,
      imageUrl: row.imageUrl,
      hasDiscount: priced.hasDiscount,
      effectivePrice: priced.effectivePrice,
      merchantOfferPercent: offerPercent,
      hasOptions: priced.hasOptions,
      optionGroups: priced.optionGroups,
      images: row.images,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      category: {
        id: row.category.id,
        name: row.category.name,
        nameAr: row.category.nameAr ?? null,
        description: row.category.description ?? null,
        descriptionAr: row.category.descriptionAr ?? null,
      },
      merchant: {
        id: merchant.id,
        name: merchant.name,
        nameAr: merchant.nameAr ?? null,
        logoUrl: merchant.imageUrl,
        deliveryTime: merchant.deliveryTime
          ? {
              minMinutes: merchant.deliveryTime.minMinutes,
              maxMinutes: merchant.deliveryTime.maxMinutes,
            }
          : null,
      },
    });
  }

  /** Public storefront: guest or customer; store may be CLOSED but must exist and be active. */
  async listCategoriesForStorefront(
    merchantId: string,
    page = 1,
    limit = 20,
    i18n?: I18nOptions,
  ) {
    void page;
    void limit;
    await this.assertMerchantBrowsable(merchantId);
    const result = await this.collectAllStorefrontPages((p, l) =>
      this.fetchCategoriesPaged(merchantId, p, l, true),
    );
    return this.localizePagedCategories(result, i18n);
  }

  async listCategories(merchantId: string, page = 1, limit = 20) {
    await this.assertMerchantExists(merchantId);
    return this.fetchCategoriesPaged(merchantId, page, limit);
  }

  async getCategory(merchantId: string, categoryId: string) {
    await this.assertMerchantExists(merchantId);
    const category = await this.prisma.merchantCategory.findFirst({
      where: { id: categoryId, merchantId },
      include: {
        _count: {
          select: { products: true },
        },
      },
    });
    if (!category) {
      throw new NotFoundException('Category not found');
    }
    return category;
  }

  private async fetchCategoriesPaged(
    merchantId: string,
    page: number,
    limit: number,
    activeProductsOnly = false,
  ) {
    const pg = this.normalizePagination(page, limit);
    const where = { merchantId };
    const [total, items] = await this.prisma.$transaction([
      this.prisma.merchantCategory.count({ where }),
      this.prisma.merchantCategory.findMany({
        where,
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        include: {
          _count: {
            select: {
              products: activeProductsOnly
                ? { where: { isActive: true } }
                : true,
            },
          },
        },
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
    const updated = await this.prisma.merchantCategory.update({
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
    if (
      dto.imageUrl !== undefined &&
      existing.imageUrl &&
      existing.imageUrl !== dto.imageUrl
    ) {
      await this.s3.deleteImageByUrl(existing.imageUrl);
    }
    return updated;
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
    await this.s3.deleteImageByUrl(existing.imageUrl);
    return { message: 'Category deleted' };
  }

  async listProductsForStorefront(
    merchantId: string,
    categoryId: string,
    page = 1,
    limit = 20,
    activeProductsOnly = false,
    i18n?: I18nOptions,
  ) {
    await this.assertMerchantBrowsable(merchantId);
    const result = await this.fetchProductsPaged(
      merchantId,
      categoryId,
      page,
      limit,
      true,
      activeProductsOnly,
    );
    return this.localizePagedProducts(result, i18n);
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
    const items = rows.map((p) => {
      const priced = this.attachProductPricing(
        p,
        activeOptionsOnly,
        activeOptionsOnly ? offerPercent : undefined,
      );
      return activeOptionsOnly
        ? this.toStorefrontProductListItem(priced)
        : priced;
    });
    return this.pagedResponse(items, total, pg.page, pg.limit);
  }

  async listAllProductsForStorefront(
    merchantId: string,
    categoryId?: string,
    page = 1,
    limit = 20,
    activeProductsOnly = false,
    i18n?: I18nOptions,
  ) {
    await this.assertMerchantBrowsable(merchantId);
    const result = await this.fetchAllProductsPaged(
      merchantId,
      categoryId,
      page,
      limit,
      true,
      activeProductsOnly,
    );
    return this.localizePagedProducts(result, i18n);
  }

  async listAllProducts(
    merchantId: string,
    categoryId?: string,
    page = 1,
    limit = 20,
    name?: string,
    i18n?: I18nOptions,
  ) {
    await this.assertMerchantExists(merchantId);
    const result = await this.fetchAllProductsPaged(
      merchantId,
      categoryId,
      page,
      limit,
      false,
      false,
      name,
      i18n?.locale,
    );
    return this.localizePagedProducts(result, i18n);
  }

  private async fetchAllProductsPaged(
    merchantId: string,
    categoryId: string | undefined,
    page: number,
    limit: number,
    activeOptionsOnly: boolean,
    activeProductsOnly = false,
    name?: string,
    searchLocale?: I18nOptions['locale'],
  ) {
    if (categoryId !== undefined && categoryId !== '') {
      const category = await this.prisma.merchantCategory.findFirst({
        where: { id: categoryId, merchantId },
      });
      if (!category) {
        throw new NotFoundException('Category not found');
      }
    }

    const nameFilter = this.buildProductNameWhereClause(name, searchLocale);
    const where: Prisma.ProductWhereInput = {
      category: { merchantId },
      ...(categoryId !== undefined && categoryId !== '' ? { categoryId } : {}),
      ...(activeProductsOnly ? { isActive: true } : {}),
      ...(nameFilter ?? {}),
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
    const items = rows.map((p) => {
      const priced = {
        ...this.attachProductPricing(
          p,
          activeOptionsOnly,
          activeOptionsOnly ? offerPercent : undefined,
        ),
        category: p.category,
      };
      return activeOptionsOnly
        ? this.toStorefrontProductListItem(priced)
        : priced;
    });
    return this.pagedResponse(items, total, pg.page, pg.limit);
  }

  /**
   * Products from active merchants that currently have a live store offer.
   * Pagination is applied in the database.
   */
  async listDiscountedProductsAcrossMerchants(
    page = 1,
    limit = 20,
    scopeMerchantIds: string[] = [],
    activeProductsOnly = false,
    i18n?: I18nOptions,
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

    const now = new Date();

    const countRows = await this.prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*)::bigint AS count
      FROM products p
      INNER JOIN merchant_categories mc ON mc.id = p.category_id
      INNER JOIN merchants m ON m.id = mc.merchant_id
      WHERE m.is_active = true
        AND m.id IN (${openIdList})
        AND EXISTS (
          SELECT 1
          FROM merchant_offers mo
          WHERE mo.merchant_id = m.id
            AND mo.is_active = true
            AND mo.starts_at <= ${now}
            AND mo.ends_at > ${now}
        )
        ${activeProductSql}
    `;
    const total = Number(countRows[0]?.count ?? 0);

    const idRows = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT p.id
      FROM products p
      INNER JOIN merchant_categories mc ON mc.id = p.category_id
      INNER JOIN merchants m ON m.id = mc.merchant_id
      WHERE m.is_active = true
        AND m.id IN (${openIdList})
        AND EXISTS (
          SELECT 1
          FROM merchant_offers mo
          WHERE mo.merchant_id = m.id
            AND mo.is_active = true
            AND mo.starts_at <= ${now}
            AND mo.ends_at > ${now}
        )
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
            merchant: { select: { id: true, name: true, nameAr: true } },
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

    const offerByMerchant = new Map<string, number | null>();
    for (const p of ordered) {
      const mid = p.category.merchant.id;
      if (!offerByMerchant.has(mid)) {
        offerByMerchant.set(
          mid,
          await this.merchantOffers.getLiveOfferPercentForMerchant(mid),
        );
      }
    }

    const items = ordered.map((p) => {
      const offerPercent = offerByMerchant.get(p.category.merchant.id) ?? null;
      return this.toStorefrontProductListItem({
        ...this.attachProductPricing(p, true, offerPercent),
        category: {
          id: p.category.id,
          name: p.category.name,
          nameAr: p.category.nameAr,
        },
        merchant: {
          id: p.category.merchant.id,
          name: p.category.merchant.name,
          nameAr: p.category.merchant.nameAr,
        },
      });
    });

    return this.localizePagedProducts(
      this.pagedResponse(items, total, pg.page, pg.limit),
      i18n,
    );
  }

  /**
   * Public storefront: search products by name across active merchants in the
   * user's service area. Locale (`?lang=ar|en`) selects Arabic or English name field.
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
      i18n?: I18nOptions;
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
      ...buildNameSearchWhere(term, filters.i18n?.locale),
      ...(filters.activeProductsOnly ? { isActive: true } : {}),
      category: {
        merchant: {
          id: { in: filters.scopeMerchantIds },
          isEnabled: true,
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
              merchant: { select: { id: true, name: true, nameAr: true } },
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

    const items = rows.map((p) =>
      this.toStorefrontProductListItem({
        ...this.attachProductPricing(p, true),
        category: {
          id: p.category.id,
          name: p.category.name,
          nameAr: p.category.nameAr,
        },
        merchant: {
          id: p.category.merchant.id,
          name: p.category.merchant.name,
          nameAr: p.category.merchant.nameAr,
        },
      }),
    );

    return this.localizePagedProducts(
      this.pagedResponse(items, total, pg.page, pg.limit),
      filters.i18n,
    );
  }

  /**
   * Public storefront: search products by name within one merchant.
   * Locale (`?lang=ar|en`) selects Arabic or English name field.
   */
  async searchProductsInMerchant(
    merchantId: string,
    name: string,
    page = 1,
    limit = 20,
    filters: {
      categoryId?: string;
      activeProductsOnly?: boolean;
      i18n?: I18nOptions;
    } = {},
  ) {
    await this.assertMerchantBrowsable(merchantId);

    const term = normalizeNameSearchTerm(name);
    const categoryId = filters.categoryId?.trim();

    if (categoryId) {
      const category = await this.prisma.merchantCategory.findFirst({
        where: { id: categoryId, merchantId },
      });
      if (!category) {
        throw new NotFoundException('Category not found');
      }
    }

    const pg = this.normalizePagination(page, limit);
    const where: Prisma.ProductWhereInput = {
      ...buildNameSearchWhere(term, filters.i18n?.locale),
      category: { merchantId },
      ...(categoryId ? { categoryId } : {}),
      ...(filters.activeProductsOnly ? { isActive: true } : {}),
    };

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({
        where,
        include: {
          category: { select: { id: true, name: true, nameAr: true } },
          images: { orderBy: { sortOrder: 'asc' } },
          ...OPTION_GROUPS_INCLUDE,
        },
        orderBy: [{ name: 'asc' }],
        skip: pg.skip,
        take: pg.limit,
      }),
    ]);

    const offerPercent =
      await this.merchantOffers.getLiveOfferPercentForMerchant(merchantId);
    const items = rows.map((p) =>
      this.toStorefrontProductListItem({
        ...this.attachProductPricing(p, true, offerPercent),
        category: p.category,
      }),
    );

    return this.localizePagedProducts(
      this.pagedResponse(items, total, pg.page, pg.limit),
      filters.i18n,
    );
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

    if (dto.optionGroups !== undefined) {
      this.assertOptionGroupsValid(dto.optionGroups);
    }

    const { extraImageUrls, imageUrl, optionGroups, categoryId, ...rest } =
      dto as UpdateProductDto & { categoryId?: string };

    if (categoryId !== undefined) {
      const category = await this.prisma.merchantCategory.findFirst({
        where: { id: categoryId, merchantId },
      });
      if (!category) {
        throw new NotFoundException('Category not found');
      }
    }

    // Snapshot old gallery URLs before replacing them in the transaction
    let oldGalleryUrls: string[] = [];
    if (extraImageUrls !== undefined) {
      const oldImages = await this.prisma.productImage.findMany({
        where: { productId },
        select: { url: true },
      });
      oldGalleryUrls = oldImages.map((img) => img.url);
    }

    const result = await this.prisma.$transaction(async (tx) => {
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
          ...(categoryId !== undefined ? { categoryId } : {}),
          ...(rest.name !== undefined ? { name: rest.name } : {}),
          ...(rest.description !== undefined
            ? { description: rest.description }
            : {}),
          ...(rest.nameAr !== undefined ? { nameAr: rest.nameAr } : {}),
          ...(rest.descriptionAr !== undefined
            ? { descriptionAr: rest.descriptionAr }
            : {}),
          ...(rest.isActive !== undefined ? { isActive: rest.isActive } : {}),
          ...(rest.price !== undefined
            ? { price: new Prisma.Decimal(rest.price) }
            : {}),
          ...(imageUrl !== undefined ? { imageUrl } : {}),
        },
        include: {
          images: { orderBy: { sortOrder: 'asc' } },
          ...OPTION_GROUPS_INCLUDE,
        },
      });
      return this.attachProductPricing(updated, false);
    });

    // Delete replaced main image from S3
    if (imageUrl !== undefined && product.imageUrl && product.imageUrl !== imageUrl) {
      await this.s3.deleteImageByUrl(product.imageUrl);
    }

    // Delete replaced gallery images from S3
    if (oldGalleryUrls.length > 0) {
      await Promise.all(oldGalleryUrls.map((url) => this.s3.deleteImageByUrl(url)));
    }

    return result;
  }

  async deleteProduct(merchantId: string, productId: string) {
    await this.assertMerchantExists(merchantId);
    const product = await this.prisma.product.findFirst({
      where: {
        id: productId,
        category: { merchantId },
      },
      include: { images: true },
    });
    if (!product) {
      throw new NotFoundException('Product not found');
    }
    await this.prisma.product.delete({ where: { id: productId } });

    // Delete main image and all gallery images from S3
    const urlsToDelete = [
      product.imageUrl,
      ...product.images.map((img) => img.url),
    ].filter((u): u is string => Boolean(u));
    await Promise.all(urlsToDelete.map((url) => this.s3.deleteImageByUrl(url)));

    return { message: 'Product deleted' };
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

  /** @deprecated Prefer assertMerchantBrowsable — open-for-orders is checkout-only. */
  private async assertMerchantActive(merchantId: string): Promise<void> {
    await this.assertMerchantBrowsable(merchantId);
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

  /** Store exists and is admin-enabled. Manual CLOSED / outside hours still allow menu browse. */
  private async assertMerchantBrowsable(merchantId: string): Promise<void> {
    const merchant = await this.prisma.merchant.findUnique({
      where: { id: merchantId },
      select: { isEnabled: true },
    });
    if (!merchant?.isEnabled) {
      throw new NotFoundException('Merchant not found or inactive');
    }
  }
}
