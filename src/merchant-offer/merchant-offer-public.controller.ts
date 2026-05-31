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
import { MerchantOfferService } from './merchant-offer.service';

@ApiTags('Storefront')
@Controller('merchants')
export class MerchantOfferPublicController {
  constructor(private readonly offers: MerchantOfferService) {}

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
    description: 'Filter to one merchant (UUID). Omit to list all merchants with active offers.',
  })
  @Get('offers')
  listPublic(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('merchantId') merchantId?: string,
  ) {
    return this.offers.listPublic(page, limit, merchantId);
  }

  @ApiOperation({
    summary: 'Active offers for one merchant store',
    description:
      'Same as GET /merchants/offers?merchantId=… — use when you already know the store id (e.g. from merchant profile).',
  })
  @ApiParam({ name: 'merchantId', type: String, format: 'uuid' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @Get(':merchantId/offers')
  listForMerchant(
    @Param('merchantId', ParseUUIDPipe) merchantId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.offers.listPublic(page, limit, merchantId);
  }
}
