import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { MerchantOfferService } from '../../merchant-offer/merchant-offer.service';
import { MerchantCatalogService } from '../../merchant-catalog/merchant-catalog.service';
import { resolveStorefrontProductPricing } from '../../merchant-offer/merchant-offer-pricing';
import {
  formatProductNameWithOptions,
  resolveUnitPriceWithOptions,
  validateProductOptionSelections,
} from '../../common/product-option-pricing';
import type { ProductOptionGroupView } from '../../merchant/product-option.types';
import type { QuoteProductOptionsV3Dto } from './dto/quote-product-options-v3.dto';
import type { QuoteProductOptionsV3ResponseDto } from './dto/quote-product-options-v3-response.dto';
import type { ProductOptionsProductV3ResponseDto } from './dto/product-option-group-v3-response.dto';
import type { ProductOptionGroupDto } from '../../merchant-catalog/dto/product-option.dto';

const OPTION_GROUPS_INCLUDE = {
  optionGroups: {
    orderBy: { sortOrder: 'asc' as const },
    include: {
      choices: {
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' as const },
      },
    },
  },
};

@Injectable()
export class ProductOptionsV3Service {
  constructor(
    private readonly prisma: PrismaService,
    private readonly merchantOffers: MerchantOfferService,
    private readonly catalog: MerchantCatalogService,
  ) {}

  async getProductOptionsForStorefront(
    productId: string,
  ): Promise<ProductOptionsProductV3ResponseDto> {
    const product = await this.catalog.getProductForStorefront(productId, true);
    const optionGroups = product.optionGroups;
    const hasOptions = (optionGroups?.length ?? 0) > 0;
    return {
      productId: product.id,
      name: product.name,
      nameAr: product.nameAr,
      price: product.price,
      discountPrice: product.discountPrice,
      effectivePrice: product.effectivePrice,
      hasOptions,
      ...(hasOptions && optionGroups ? { optionGroups } : {}),
    };
  }

  async quoteLines(
    dto: QuoteProductOptionsV3Dto,
  ): Promise<QuoteProductOptionsV3ResponseDto> {
    const productIds = [...new Set(dto.lines.map((l) => l.productId))];
    const products = await this.prisma.product.findMany({
      where: {
        id: { in: productIds },
        category: { merchantId: dto.merchantId },
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        price: true,
        optionGroups: {
          orderBy: { sortOrder: 'asc' },
          include: {
            choices: {
              where: { isActive: true },
              orderBy: { sortOrder: 'asc' },
            },
          },
        },
      },
    });

    if (products.length !== productIds.length) {
      throw new BadRequestException(
        'One or more products are invalid, inactive, or belong to a different merchant',
      );
    }

    const productById = new Map(products.map((p) => [p.id, p]));
    const offerPercent =
      await this.merchantOffers.getLiveOfferPercentForMerchant(dto.merchantId);

    const lines = dto.lines.map((line) => {
      const catalog = productById.get(line.productId);
      if (!catalog) {
        throw new BadRequestException('Invalid product');
      }

      const listPrice = Number(catalog.price);
      const pricing = resolveStorefrontProductPricing(listPrice, offerPercent);
      const { selected } = validateProductOptionSelections(
        catalog.optionGroups,
        line.selectedChoiceIds,
      );
      const modifiers = selected.map((s) => s.priceModifier);
      const unitPrice = resolveUnitPriceWithOptions(
        listPrice,
        pricing.discountPrice,
        modifiers,
      );
      const displayName = formatProductNameWithOptions(catalog.name, selected);

      return {
        productId: line.productId,
        productName: catalog.name,
        displayName,
        quantity: line.quantity,
        listPrice,
        discountPrice: pricing.discountPrice,
        unitPrice,
        totalPrice: Math.round(unitPrice * line.quantity * 100) / 100,
        selectedOptions: selected,
      };
    });

    const subtotal =
      Math.round(lines.reduce((sum, l) => sum + l.totalPrice, 0) * 100) / 100;

    return {
      merchantId: dto.merchantId,
      lines,
      subtotal,
    };
  }

  async getMerchantProductOptions(
    merchantId: string,
    productId: string,
  ): Promise<{
    productId: string;
    name: string;
    nameAr: string | null;
    price: number;
    hasOptions: boolean;
    optionGroups: ProductOptionGroupView[];
  }> {
    const row = await this.prisma.product.findFirst({
      where: { id: productId, category: { merchantId } },
      include: OPTION_GROUPS_INCLUDE,
    });
    if (!row) {
      throw new NotFoundException('Product not found');
    }

    const optionGroups = row.optionGroups
      .map((g) => ({
        id: g.id,
        name: g.name,
        nameAr: g.nameAr,
        isRequired: g.isRequired,
        minSelect: g.minSelect,
        maxSelect: g.maxSelect,
        sortOrder: g.sortOrder,
        choices: g.choices.map((c) => ({
          id: c.id,
          name: c.name,
          nameAr: c.nameAr,
          priceModifier: Number(c.priceModifier),
          sortOrder: c.sortOrder,
          isActive: c.isActive,
        })),
      }))
      .filter((g) => g.choices.length > 0);

    return {
      productId: row.id,
      name: row.name,
      nameAr: row.nameAr,
      price: Number(row.price),
      hasOptions: optionGroups.length > 0,
      optionGroups,
    };
  }

  async replaceMerchantProductOptions(
    merchantId: string,
    productId: string,
    optionGroups: ProductOptionGroupDto[],
  ) {
    const updated = await this.catalog.updateProduct(merchantId, productId, {
      optionGroups,
    });
    const savedOptionGroups = updated.optionGroups ?? [];
    return {
      productId: updated.id,
      name: updated.name,
      nameAr: updated.nameAr,
      price: updated.price,
      hasOptions: savedOptionGroups.length > 0,
      optionGroups: savedOptionGroups,
    };
  }
}
