import {
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Query,
} from '@nestjs/common';
import { MerchantController } from '../../merchant.controller';
import { MerchantCatalogService } from '../../merchant-catalog/merchant-catalog.service';
import { MerchantIntegrationService } from '../../merchant.integration.service';
import { MerchantOfferService } from '../../merchant-offer/merchant-offer.service';
import { ParseUuidMerchantIdPipe } from '../../common/parse-uuid-merchant-id.pipe';
import {
  parseRequiredLatLng,
  parseStorefrontSearchType,
} from '../../common/storefront-location';

/**
 * V2 storefront: inactive products are hidden from customers.
 * V1 keeps showing all products for backward compatibility.
 */
@Controller({ path: 'merchants', version: '2' })
export class MerchantStorefrontV2Controller extends MerchantController {
  constructor(
    merchantIntegrationService: MerchantIntegrationService,
    merchantCatalogService: MerchantCatalogService,
    merchantOfferService: MerchantOfferService,
  ) {
    super(
      merchantIntegrationService,
      merchantCatalogService,
      merchantOfferService,
    );
  }

  @Get('search')
  async searchStorefront(
    @Query('name') name: string,
    @Query('type') type: string,
    @Query('lat') lat: string,
    @Query('lng') lng: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('merchantType') merchantType?: string,
  ) {
    const searchType = parseStorefrontSearchType(type);
    const { lat: userLat, lng: userLng } = parseRequiredLatLng(lat, lng);

    if (searchType === 'merchant') {
      const result =
        await this.merchantIntegrationService.searchMerchantsByName(
          name,
          page,
          limit,
          { merchantTypeCode: merchantType, userLat, userLng },
        );
      return { type: searchType, ...result };
    }

    const scopeMerchantIds =
      await this.merchantIntegrationService.getMerchantIdsInUserServiceArea(
        userLat,
        userLng,
      );
    const result = await this.merchantCatalogService.searchProductsByName(
      name,
      page,
      limit,
      {
        merchantTypeCode: merchantType,
        scopeMerchantIds,
        activeProductsOnly: true,
      },
    );
    return { type: searchType, ...result };
  }

  @Get('products/discounts')
  async listDiscountedProductsAcrossMerchants(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('lat') lat: string,
    @Query('lng') lng: string,
  ) {
    const { lat: userLat, lng: userLng } = parseRequiredLatLng(lat, lng);
    const scopeMerchantIds =
      await this.merchantIntegrationService.getMerchantIdsInUserServiceArea(
        userLat,
        userLng,
      );
    return this.merchantCatalogService.listDiscountedProductsAcrossMerchants(
      page,
      limit,
      scopeMerchantIds,
      true,
    );
  }

  @Get('products/:productId')
  getStorefrontProduct(@Param('productId', ParseUUIDPipe) productId: string) {
    return this.merchantCatalogService.getProductForStorefront(productId, true);
  }

  @Get(':merchantId/products')
  listStorefrontProducts(
    @Param('merchantId', ParseUuidMerchantIdPipe) merchantId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('categoryId', new ParseUUIDPipe({ optional: true }))
    categoryId?: string,
  ) {
    return this.merchantCatalogService.listAllProductsForStorefront(
      merchantId,
      categoryId,
      page,
      limit,
      true,
    );
  }

  @Get(':merchantId/categories/:categoryId/products')
  listStorefrontCategoryProducts(
    @Param('merchantId', ParseUuidMerchantIdPipe) merchantId: string,
    @Param('categoryId', ParseUUIDPipe) categoryId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.merchantCatalogService.listProductsForStorefront(
      merchantId,
      categoryId,
      page,
      limit,
      true,
    );
  }
}
