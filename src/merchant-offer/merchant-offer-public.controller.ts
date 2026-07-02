import {
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { I18n, type I18nOptions } from '../common/i18n';
import { MerchantOfferService } from './merchant-offer.service';

@ApiTags('Storefront')
@Controller('merchants')
export class MerchantOfferPublicController {
  constructor(private readonly offers: MerchantOfferService) {}

  @ApiOperation({
    summary: 'Active offers for one merchant store',
    description:
      'Same as GET /merchants/offers?merchantId=… — use when you already know the store id (e.g. from merchant profile).',
  })
  @ApiParam({ name: 'merchantId', type: String, format: 'uuid' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiQuery({
    name: 'lang',
    required: false,
    enum: ['en', 'ar'],
    description: 'Response language (en or ar). Omit for bilingual fields.',
  })
  @Get(':merchantId/offers')
  listForMerchant(
    @Param('merchantId', ParseUUIDPipe) merchantId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @I18n() i18n?: I18nOptions,
  ) {
    return this.offers.listPublic(page, limit, merchantId, i18n);
  }
}
