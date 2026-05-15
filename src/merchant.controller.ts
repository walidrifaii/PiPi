import {
  BadRequestException,
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
  Get,
  Param,
  ParseIntPipe,
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
import {
  merchantIsActiveFromStoreStatus,
  SetMerchantStoreStatusDto,
} from './merchant/dto/set-merchant-store-status.dto';
import { UpdateMerchantDto } from './merchant/dto/update-merchant.dto';
import { UpsertMerchantWorkingHoursDto } from './merchant/dto/upsert-merchant-working-hours.dto';
import { MerchantCatalogService } from './merchant-catalog/merchant-catalog.service';
import { MerchantIntegrationService } from './merchant.integration.service';

@Controller('merchants')
export class MerchantController {
  constructor(
    private readonly merchantIntegrationService: MerchantIntegrationService,
    private readonly merchantCatalogService: MerchantCatalogService,
  ) {}

  @ApiTags('Storefront')
  @ApiOperation({
    summary: 'List merchants',
    description:
      'Without cityCode: all merchants (any manual OPEN state; `isOpenNow` / `status` reflect working hours when enabled). Each item can include `workingHoursSchedule` (Mon–Sun with English `weekday` and `intervals` using `h:mm AM/PM`, empty when closed that day; null when `useWorkingHours` is false). With cityCode: only merchants in that city that are manually OPEN and, if they use working hours, currently inside their schedule. With lat+lng (optional cityCode): sorts by distance (near me); each item may include distanceKm. Optional radiusKm requires lat+lng and keeps merchants within that distance (excludes those without coordinates). Merchants without coordinates sort last when using lat+lng. If cityCode is set and an active service area has a GeoJSON boundary for that code, then with lat+lng the user must lie inside the polygon or the list is empty; all merchants for that cityCode are still returned (merchant GPS is not required to fall inside the polygon).',
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
      'Service area. When set, only merchants in that city that are manually OPEN and, if they use working hours, currently inside their schedule.',
  })
  @ApiQuery({
    name: 'lat',
    required: false,
    description:
      'User latitude (WGS84). Must be sent with lng. Optional cityCode filters the set before distance sort.',
  })
  @ApiQuery({
    name: 'lng',
    required: false,
    description:
      'User longitude (WGS84). Must be sent with lat. Optional cityCode filters the set before distance sort.',
  })
  @ApiQuery({
    name: 'radiusKm',
    required: false,
    description:
      'Optional max distance in km (requires lat and lng). Merchants without coordinates are excluded.',
  })
  @ApiOkResponse({
    description: 'Merchant list',
    schema: {
      example: [
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
          useWorkingHours: false,
          timezone: null,
          workingHoursSchedule: null,
          createdAt: '2026-04-07T11:00:00.000Z',
          updatedAt: '2026-04-07T11:00:00.000Z',
        },
      ],
    },
  })
  @Get()
  getMerchants(
    @Query('merchantType') merchantType?: string,
    @Query('cityCode') cityCode?: string,
    @Query('lat') lat?: string,
    @Query('lng') lng?: string,
    @Query('radiusKm') radiusKm?: string,
  ) {
    return this.merchantIntegrationService.getMerchants({
      merchantTypeCode: merchantType,
      cityCode,
      lat,
      lng,
      radiusKm,
    });
  }

  @ApiTags('Storefront')
  @ApiOperation({
    summary:
      'List discounted products across all active merchants (on sale: discount price below list price)',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @Get('products/discounts')
  listDiscountedProductsAcrossMerchants(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.merchantCatalogService.listDiscountedProductsAcrossMerchants(
      page,
      limit,
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
      'Response includes `workingHoursSchedule`: all 7 days with English `weekday` and `intervals` using `h:mm AM/PM` (empty when closed that day), or null when useWorkingHours is false.',
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
  @ApiOperation({
    summary:
      'Edit a merchant (super admin). New stores: POST /auth/merchant/register.',
  })
  @Patch('admin/:merchantId')
  updateMerchantAsSuperAdmin(
    @Param('merchantId') merchantId: string,
    @Body() dto: UpdateMerchantDto,
  ) {
    return this.merchantIntegrationService.updateMerchant(merchantId, dto);
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
