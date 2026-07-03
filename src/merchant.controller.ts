import {
  BadRequestException,
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { MerchantAccountGuard } from './auth/merchant-account.guard';
import { SuperAdminGuard } from './auth/super-admin.guard';
import { JwtUserPayload } from './auth/jwt-user.payload';
import { SetMerchantActiveDto } from './merchant/dto/set-merchant-active.dto';
import { SetMerchantEnabledDto } from './merchant/dto/set-merchant-enabled.dto';
import {
  merchantIsActiveFromStoreStatus,
  SetMerchantStoreStatusDto,
} from './merchant/dto/set-merchant-store-status.dto';
import { UpdateMerchantDto } from './merchant/dto/update-merchant.dto';
import { UpsertMerchantWorkingHoursDto } from './merchant/dto/upsert-merchant-working-hours.dto';
import { ParseUuidMerchantIdPipe } from './common/parse-uuid-merchant-id.pipe';
import { MerchantCatalogService } from './merchant-catalog/merchant-catalog.service';
import { MerchantIntegrationService } from './merchant.integration.service';
import { MerchantOfferService } from './merchant-offer/merchant-offer.service';
import {
  parseRequiredLatLng,
  parseStorefrontSearchType,
} from './common/storefront-location';
import { I18n, type I18nOptions } from './common/i18n';

@Controller('merchants')
export class MerchantController {
  constructor(
    protected readonly merchantIntegrationService: MerchantIntegrationService,
    protected readonly merchantCatalogService: MerchantCatalogService,
    protected readonly merchantOfferService: MerchantOfferService,
  ) {}

  @ApiTags('Storefront')
  @ApiOperation({
    summary: 'List merchants',
    description:
      'Without cityCode and without lat+lng: all merchants (`isOpenNow` / `status` reflect manual OPEN and working hours). With cityCode or lat+lng: merchants in that service area (including closed), with `isOpenNow` / `status` for display. With lat+lng only: picks the **smallest** active polygon that contains the user (overlaps), then filters merchants whose GPS is inside that same boundary. Optional radiusKm caps distance.',
  })
  @ApiQuery({
    name: 'merchantType',
    required: false,
    description:
      'Optional filter by merchant type code (e.g. SUPERMARKET). See GET /merchant-types.',
  })
  @ApiQuery({
    name: 'cityCode',
    required: false,
    example: 'TRIPOLI',
    description:
      'Service area filter. Returns merchants in that city **including** closed ones; `isOpenNow` / `status` show customer-visible OPEN/CLOSED.',
  })
  @ApiQuery({
    name: 'lat',
    required: false,
    description:
      'User latitude (WGS84). Must be sent with lng. Without cityCode, the backend picks the service area whose polygon contains this point.',
  })
  @ApiQuery({
    name: 'lng',
    required: false,
    description:
      'User longitude (WGS84). Must be sent with lat. Without cityCode, used with lat to resolve the service area polygon.',
  })
  @ApiQuery({
    name: 'radiusKm',
    required: false,
    description:
      'Optional max distance in km (requires lat and lng). Merchants without coordinates are excluded.',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiQuery({
    name: 'lang',
    required: false,
    enum: ['en', 'ar'],
    description:
      'Response language. Omit for bilingual fields (name + nameAr). Use ar or en for a single localized value per field.',
  })
  @ApiOkResponse({
    description: 'Paginated merchant list',
    schema: {
      example: {
        items: [
          {
            id: '11111111-1111-1111-1111-111111111111',
            name: 'Fresh Basket Market',
            merchantTypeId: 'a0000000-0000-4000-8000-000000000001',
            merchantType: 'SUPERMARKET',
            cityCode: 'TRIPOLI',
            latitude: 34.43,
            longitude: 35.84,
            logoUrl: 'https://example.com/merchant-logo.jpg',
            coverImageUrl: 'https://example.com/merchant-cover.jpg',
            isActive: true,
            isOpenNow: true,
            status: 'OPEN',
            distanceKm: 1.2,
            createdAt: '2026-04-07T11:00:00.000Z',
            updatedAt: '2026-04-07T11:00:00.000Z',
          },
          {
            id: '22222222-2222-2222-2222-222222222222',
            name: 'Always-on store',
            merchantTypeId: 'a0000000-0000-4000-8000-000000000001',
            merchantType: 'SUPERMARKET',
            cityCode: 'TRIPOLI',
            latitude: 34.5,
            longitude: 35.9,
            logoUrl: null,
            coverImageUrl: null,
            isActive: true,
            isOpenNow: true,
            status: 'OPEN',
            createdAt: '2026-04-07T11:00:00.000Z',
            updatedAt: '2026-04-07T11:00:00.000Z',
          },
        ],
        pagination: {
          page: 1,
          limit: 20,
          pageTotal: 2,
          total: 2,
          totalPages: 1,
        },
      },
    },
  })
  @Get()
  getMerchants(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('merchantType') merchantType?: string,
    @Query('cityCode') cityCode?: string,
    @Query('lat') lat?: string,
    @Query('lng') lng?: string,
    @Query('radiusKm') radiusKm?: string,
    @I18n() i18n?: I18nOptions,
  ) {
    return this.merchantIntegrationService.getMerchants({
      merchantTypeCode: merchantType,
      cityCode,
      lat,
      lng,
      radiusKm,
      page,
      limit,
      i18n,
    });
  }

  @ApiTags('Storefront')
  @ApiOperation({
    operationId: 'storefrontSearch',
    summary: 'Search merchants or products by name (public)',
    description:
      'No auth required. **Required:** `lat`, `lng`, and `type` (`merchant` or `product`). If the user coordinates are outside every active service-area polygon, returns an empty list. Otherwise only stores whose GPS is inside that same polygon are included. Names are matched as a **substring** (case-insensitive), e.g. `burger` matches "Cheese Burger". With `?lang=ar` searches Arabic names only; with `?lang=en` searches English names only. Minimum 2 characters. Optional `merchantType` filters results.',
  })
  @ApiQuery({
    name: 'name',
    required: true,
    example: 'walid',
    description:
      'Search term (at least 2 characters; matched anywhere in the store/product name)',
  })
  @ApiQuery({
    name: 'type',
    required: true,
    enum: ['merchant', 'product'],
    description: 'Search merchants or products (required)',
  })
  @ApiQuery({
    name: 'lat',
    required: true,
    description: 'User latitude (WGS84)',
  })
  @ApiQuery({
    name: 'lng',
    required: true,
    description: 'User longitude (WGS84)',
  })
  @ApiQuery({
    name: 'merchantType',
    required: false,
    description: 'Optional filter by merchant type code (e.g. SUPERMARKET)',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiOkResponse({
    description: 'Paginated merchants or products matching the search term',
    schema: {
      example: {
        type: 'merchant',
        items: [
          {
            id: '11111111-1111-1111-1111-111111111111',
            name: 'Fresh Basket Market',
            merchantType: 'SUPERMARKET',
            isOpenNow: true,
            status: 'OPEN',
          },
        ],
        pagination: {
          page: 1,
          limit: 20,
          pageTotal: 1,
          total: 1,
          totalPages: 1,
        },
      },
    },
  })
  @Get('search')
  async searchStorefront(
    @Query('name') name: string,
    @Query('type') type: string,
    @Query('lat') lat: string,
    @Query('lng') lng: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('merchantType') merchantType?: string,
    @I18n() i18n?: I18nOptions,
  ) {
    const searchType = parseStorefrontSearchType(type);
    const { lat: userLat, lng: userLng } = parseRequiredLatLng(lat, lng);

    if (searchType === 'merchant') {
      const result =
        await this.merchantIntegrationService.searchMerchantsByName(
          name,
          page,
          limit,
          { merchantTypeCode: merchantType, userLat, userLng, i18n },
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
      { merchantTypeCode: merchantType, scopeMerchantIds, i18n },
    );
    return { type: searchType, ...result };
  }

  @ApiTags('Storefront')
  @ApiOperation({
    summary:
      'List discounted products across active merchants in the user service area (on sale: discount price below list price)',
    description:
      'Requires lat and lng. If the user is outside every active service-area polygon, returns an empty list. Only products from stores whose GPS is inside that same polygon are included.',
  })
  @ApiQuery({
    name: 'lat',
    required: true,
    description: 'User latitude (WGS84)',
  })
  @ApiQuery({
    name: 'lng',
    required: true,
    description: 'User longitude (WGS84)',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @Get('products/discounts')
  async listDiscountedProductsAcrossMerchants(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('lat') lat: string,
    @Query('lng') lng: string,
    @I18n() i18n?: I18nOptions,
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
      false,
      i18n,
    );
  }

  @ApiTags('Storefront')
  @ApiOperation({
    summary: 'List active store promos (paginated, one image per promo)',
    description:
      'Marketing cards for customers. Checkout uses each product list price or its own discount_price — not this promo percent.',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiQuery({
    name: 'merchantId',
    required: false,
    type: String,
    description:
      'Filter to one merchant (UUID). Omit to list all merchants with active offers.',
  })
  @Get('offers')
  listMerchantOffers(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('merchantId') merchantId?: string,
    @I18n() i18n?: I18nOptions,
  ) {
    return this.merchantOfferService.listPublic(page, limit, merchantId, i18n);
  }

  @ApiTags('Storefront · Menu')
  @ApiOperation({
    operationId: 'storefrontGetProduct',
    summary: 'Get product details by id (public)',
    description:
      'No auth required (guest or logged-in customer). Product info, gallery images, category, and merchant summary (name, logo, delivery time). Returns 404 if the product does not exist or the store is deactivated.',
  })
  @ApiParam({ name: 'productId', type: String, format: 'uuid' })
  @ApiOkResponse({
    description: 'Product details',
    schema: {
      example: {
        id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        categoryId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        name: 'Cheese Burger',
        nameAr: 'برغر جبنة',
        description: 'Beef patty with cheese',
        descriptionAr: null,
        price: 12.5,
        discountPrice: 10,
        imageUrl: 'https://example.com/product.jpg',
        hasDiscount: true,
        effectivePrice: 10,
        images: [
          {
            id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
            url: 'https://example.com/gallery.jpg',
            sortOrder: 0,
          },
        ],
        createdAt: '2026-04-07T11:00:00.000Z',
        updatedAt: '2026-04-07T11:00:00.000Z',
        category: {
          id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
          name: 'Burgers',
          nameAr: 'برغر',
          description: null,
          descriptionAr: null,
        },
        merchant: {
          id: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
          name: 'Pizza House',
          logoUrl: 'https://example.com/merchant-logo.jpg',
          deliveryTime: { minMinutes: 25, maxMinutes: 45 },
        },
      },
    },
  })
  @Get('products/:productId')
  getStorefrontProduct(
    @Param('productId', ParseUUIDPipe) productId: string,
    @I18n() i18n?: I18nOptions,
  ) {
    return this.merchantCatalogService.getProductForStorefront(
      productId,
      false,
      i18n,
    );
  }

  @ApiTags('Storefront · Menu')
  @ApiOperation({
    operationId: 'storefrontListMerchantCategories',
    summary: 'List menu categories for a store (public)',
    description:
      'No auth required. Paginated categories for the given merchant, ordered by sortOrder. Available when the store is CLOSED (browse menu); returns 404 if the merchant does not exist or is deactivated.',
  })
  @ApiParam({ name: 'merchantId', type: String, format: 'uuid' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiOkResponse({
    description: 'Paginated category list',
    schema: {
      example: {
        items: [
          {
            id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
            merchantId: '11111111-1111-1111-1111-111111111111',
            name: 'Burgers',
            nameAr: 'برغر',
            description: null,
            descriptionAr: null,
            imageUrl: 'https://example.com/category.jpg',
            sortOrder: 0,
            createdAt: '2026-04-07T11:00:00.000Z',
            updatedAt: '2026-04-07T11:00:00.000Z',
            _count: { products: 12 },
          },
        ],
        pagination: {
          page: 1,
          limit: 20,
          pageTotal: 1,
          total: 1,
          totalPages: 1,
        },
      },
    },
  })
  @ApiTags('Storefront · Menu')
  @ApiOperation({
    operationId: 'storefrontListMerchantProducts',
    summary: 'List products for a store (public)',
    description:
      'No auth required. Paginated products for the merchant. Optional `categoryId` filters to one category. Omit `categoryId` for all products. Store may be CLOSED; returns 404 if merchant is deactivated or category not found.',
  })
  @ApiParam({ name: 'merchantId', type: String, format: 'uuid' })
  @ApiQuery({
    name: 'categoryId',
    required: false,
    type: String,
    format: 'uuid',
    description: 'Optional filter by category UUID',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiOkResponse({
    description: 'Paginated product list',
    schema: {
      example: {
        items: [
          {
            id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
            categoryId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
            name: 'Cheese Burger',
            nameAr: 'برغر جبنة',
            price: 12.5,
            discountPrice: 10,
            hasDiscount: true,
            effectivePrice: 10,
            category: {
              id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
              name: 'Burgers',
              nameAr: 'برغر',
            },
          },
        ],
        pagination: {
          page: 1,
          limit: 20,
          pageTotal: 1,
          total: 1,
          totalPages: 1,
        },
      },
    },
  })
  @Get(':merchantId/products')
  listStorefrontProducts(
    @Param('merchantId', ParseUuidMerchantIdPipe) merchantId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('categoryId', new ParseUUIDPipe({ optional: true }))
    categoryId?: string,
    @I18n() i18n?: I18nOptions,
  ) {
    return this.merchantCatalogService.listAllProductsForStorefront(
      merchantId,
      categoryId,
      page,
      limit,
      false,
      i18n,
    );
  }

  @Get(':merchantId/categories')
  listStorefrontCategories(
    @Param('merchantId', ParseUuidMerchantIdPipe) merchantId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @I18n() i18n?: I18nOptions,
  ) {
    return this.merchantCatalogService.listCategoriesForStorefront(
      merchantId,
      page,
      limit,
      i18n,
    );
  }

  @ApiTags('Storefront · Menu')
  @ApiOperation({
    operationId: 'storefrontListCategoryProducts',
    summary: 'List products in a category (public)',
    description:
      'No auth required. Paginated products for the given merchant and category. Category must belong to that merchant. Store may be CLOSED; returns 404 if merchant is deactivated or category not found.',
  })
  @ApiParam({ name: 'merchantId', type: String, format: 'uuid' })
  @ApiParam({ name: 'categoryId', type: String, format: 'uuid' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiOkResponse({
    description: 'Paginated product list',
    schema: {
      example: {
        items: [
          {
            id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
            categoryId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
            name: 'Cheese Burger',
            nameAr: 'برغر جبنة',
            description: null,
            descriptionAr: null,
            price: 12.5,
            discountPrice: 10,
            imageUrl: 'https://example.com/product.jpg',
            hasDiscount: true,
            effectivePrice: 10,
            images: [
              {
                id: '...',
                url: 'https://example.com/gallery.jpg',
                sortOrder: 0,
              },
            ],
            createdAt: '2026-04-07T11:00:00.000Z',
            updatedAt: '2026-04-07T11:00:00.000Z',
          },
        ],
        pagination: {
          page: 1,
          limit: 20,
          pageTotal: 1,
          total: 1,
          totalPages: 1,
        },
      },
    },
  })
  @Get(':merchantId/categories/:categoryId/products')
  listStorefrontCategoryProducts(
    @Param('merchantId', ParseUuidMerchantIdPipe) merchantId: string,
    @Param('categoryId', ParseUUIDPipe) categoryId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @I18n() i18n?: I18nOptions,
  ) {
    return this.merchantCatalogService.listProductsForStorefront(
      merchantId,
      categoryId,
      page,
      limit,
      false,
      i18n,
    );
  }

  @ApiTags('Storefront', 'Customer')
  @ApiOperation({
    summary: 'Get merchant store profile (public)',
    description:
      'No auth required (guest or logged-in customer). Returns store branding, location, OPEN/CLOSED status, and weekly hours. Does not expose email or phone.',
  })
  @ApiParam({ name: 'merchantId', type: String, format: 'uuid' })
  @ApiOkResponse({
    description: 'Merchant public profile',
    schema: {
      example: {
        id: '11111111-1111-1111-1111-111111111111',
        name: 'Fresh Basket Market',
        merchantTypeId: 'a0000000-0000-4000-8000-000000000001',
        merchantType: 'SUPERMARKET',
        cityCode: 'TRIPOLI',
        latitude: 34.43,
        longitude: 35.84,
        logoUrl: 'https://example.com/merchant-logo.jpg',
        coverImageUrl: 'https://example.com/merchant-cover.jpg',
        isActive: true,
        isOpenNow: true,
        status: 'OPEN',
        useWorkingHours: true,
        timezone: 'Asia/Beirut',
        workingHoursSchedule: [
          {
            weekday: 'Monday',
            intervals: [{ open: '9:00 AM', close: '10:00 PM' }],
          },
          { weekday: 'Tuesday', intervals: [] },
          { weekday: 'Wednesday', intervals: [] },
          { weekday: 'Thursday', intervals: [] },
          { weekday: 'Friday', intervals: [] },
          { weekday: 'Saturday', intervals: [] },
          { weekday: 'Sunday', intervals: [] },
        ],
        createdAt: '2026-04-07T11:00:00.000Z',
        updatedAt: '2026-04-07T11:00:00.000Z',
      },
    },
  })
  @Get(':merchantId')
  getMerchantProfile(
    @Param('merchantId', ParseUuidMerchantIdPipe) merchantId: string,
    @I18n() i18n?: I18nOptions,
  ) {
    return this.merchantIntegrationService.getMerchantPublicProfile(
      merchantId,
      i18n,
    );
  }

  @ApiTags('Merchant')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, MerchantAccountGuard)
  @ApiOperation({
    summary: 'Update your store profile (merchant login only; id from token)',
  })
  @Patch('me')
  updateMyMerchant(
    @Req() req: { user?: JwtUserPayload },
    @Body() dto: UpdateMerchantDto,
  ) {
    const user = req.user;
    if (!user || user.role !== 'MERCHANT') {
      throw new BadRequestException('Merchant account required');
    }
    return this.merchantIntegrationService.updateMerchant(user.merchantId, dto);
  }

  @ApiTags('Merchant')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, MerchantAccountGuard)
  @ApiOperation({
    summary: 'Set store OPEN or CLOSED (merchant login only)',
  })
  @Patch('me/status')
  setMyMerchantStoreStatus(
    @Req() req: { user?: JwtUserPayload },
    @Body() dto: SetMerchantStoreStatusDto,
  ) {
    const user = req.user;
    if (!user || user.role !== 'MERCHANT') {
      throw new BadRequestException('Merchant account required');
    }
    return this.merchantIntegrationService.setMerchantStoreStatus(
      user.merchantId,
      merchantIsActiveFromStoreStatus(dto.status),
    );
  }

  @ApiTags('Merchant')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, MerchantAccountGuard)
  @ApiOperation({
    summary:
      'Open/close store via boolean (merchant login; prefer PATCH me/status)',
    deprecated: true,
  })
  @Patch('me/active')
  setMyMerchantActive(
    @Req() req: { user?: JwtUserPayload },
    @Body() dto: SetMerchantActiveDto,
  ) {
    const user = req.user;
    if (!user || user.role !== 'MERCHANT') {
      throw new BadRequestException('Merchant account required');
    }
    return this.merchantIntegrationService.setMerchantStoreStatus(
      user.merchantId,
      dto.isActive,
    );
  }

  @ApiTags('Merchant')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, MerchantAccountGuard)
  @ApiOperation({
    summary: 'Get weekly working hours (merchant login only)',
    description:
      'Returns `useWorkingHours`, `timezone`, and `workingHoursSchedule` (7 days, `h:mm AM/PM`, empty intervals = closed). `workingHoursSchedule` is null when scheduled hours are disabled.',
  })
  @ApiOkResponse({
    description: 'Current working hours for the logged-in merchant',
    schema: {
      example: {
        useWorkingHours: true,
        timezone: 'Asia/Beirut',
        workingHoursSchedule: [
          {
            weekday: 'Monday',
            intervals: [{ open: '9:00 AM', close: '10:00 PM' }],
          },
          { weekday: 'Tuesday', intervals: [] },
          { weekday: 'Wednesday', intervals: [] },
          { weekday: 'Thursday', intervals: [] },
          { weekday: 'Friday', intervals: [] },
          { weekday: 'Saturday', intervals: [] },
          { weekday: 'Sunday', intervals: [] },
        ],
      },
    },
  })
  @Get('me/working-hours')
  getMyMerchantWorkingHours(@Req() req: { user?: JwtUserPayload }) {
    const user = req.user;
    if (!user || user.role !== 'MERCHANT') {
      throw new BadRequestException('Merchant account required');
    }
    return this.merchantIntegrationService.getMerchantWorkingHours(
      user.merchantId,
    );
  }

  @ApiTags('Merchant')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, MerchantAccountGuard)
  @ApiOperation({
    summary: 'Set weekly working hours (merchant login only)',
    description:
      'When useWorkingHours is true, send IANA timezone (e.g. `Asia/Beirut` for Lebanon) and `days`: each `weekday` is an English day name (e.g. Monday, Mon) with `open`/`close` as 24h HH:mm or 12h h:mm AM/PM in that timezone. ' +
      'Use `intervals: []` for a closed day, or omit that weekday (treated as closed). You may send all 7 days for a full grid. ' +
      'Only open intervals are persisted (sparse rows) for fast reads. ' +
      'Customers only see the store as OPEN when isActive is true and the current local time falls inside one of the intervals. ' +
      'Set useWorkingHours to false to rely on manual OPEN/CLOSED only. ' +
      'Response matches GET /merchants/me/working-hours (`useWorkingHours`, `timezone`, `workingHoursSchedule`).',
  })
  @Patch('me/working-hours')
  setMyMerchantWorkingHours(
    @Req() req: { user?: JwtUserPayload },
    @Body() dto: UpsertMerchantWorkingHoursDto,
  ) {
    const user = req.user;
    if (!user || user.role !== 'MERCHANT') {
      throw new BadRequestException('Merchant account required');
    }
    return this.merchantIntegrationService.setMerchantWorkingHours(
      user.merchantId,
      dto,
    );
  }

  @ApiTags('Super Admin')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, SuperAdminGuard)
  @ApiParam({ name: 'merchantId', type: String })
  @ApiOperation({ summary: 'Get merchant details for super-admin edit form' })
  @Get('admin/:merchantId')
  getMerchantAsSuperAdmin(@Param('merchantId') merchantId: string) {
    return this.merchantIntegrationService.getMerchantForAdmin(merchantId);
  }

  @ApiTags('Super Admin')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, SuperAdminGuard)
  @ApiParam({ name: 'merchantId', type: String })
  @ApiOperation({
    summary:
      'Edit a merchant (super admin). New stores: POST /auth/merchant/register.',
  })
  @Patch('admin/:merchantId')
  updateMerchantAsSuperAdmin(
    @Param('merchantId') merchantId: string,
    @Body() dto: UpdateMerchantDto,
  ) {
    return this.merchantIntegrationService.updateMerchant(merchantId, dto, {
      allowFoodSharePercent: true,
    });
  }

  @ApiTags('Super Admin')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, SuperAdminGuard)
  @ApiParam({ name: 'merchantId', type: String, format: 'uuid' })
  @ApiOperation({
    summary: 'Enable or disable a merchant (super admin only)',
    description:
      'When isEnabled is false the merchant is completely hidden from all public responses (list, profile, catalog, search, offers, checkout). Merchant can still log in but customers will not see them.',
  })
  @Patch('admin/:merchantId/enabled')
  setMerchantEnabled(
    @Param('merchantId') merchantId: string,
    @Body() dto: SetMerchantEnabledDto,
  ) {
    return this.merchantIntegrationService.setMerchantEnabled(
      merchantId,
      dto.isEnabled,
    );
  }

  @ApiTags('Super Admin')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, SuperAdminGuard)
  @ApiParam({ name: 'merchantId', type: String })
  @ApiOperation({ summary: 'Delete merchant (super admin only)' })
  @Delete('admin/:merchantId')
  deleteMerchant(@Param('merchantId') merchantId: string) {
    return this.merchantIntegrationService.deleteMerchant(merchantId);
  }
}
