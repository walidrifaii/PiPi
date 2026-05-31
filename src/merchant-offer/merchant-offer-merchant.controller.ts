import {
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { MerchantJwtScopeGuard } from '../auth/merchant-jwt-scope.guard';
import { EffectiveMerchantId } from '../auth/effective-merchant-id.decorator';
import { MerchantOfferService } from './merchant-offer.service';

/** Merchants can view promos assigned by super admin; they cannot create or edit them. */
@ApiTags('Merchant')
@ApiBearerAuth()
@Controller('merchants/me/offers')
@UseGuards(JwtAuthGuard, MerchantJwtScopeGuard)
export class MerchantOfferMerchantController {
  constructor(private readonly offers: MerchantOfferService) {}

  @ApiOperation({
    summary: 'List promos assigned to your store (read-only)',
    description:
      'Created by super admin only. Shown to customers; does not change your product prices at checkout.',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @Get()
  listMine(
    @EffectiveMerchantId() merchantId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.offers.listForMerchant(merchantId, page, limit);
  }

  @ApiOperation({ summary: 'Get one promo assigned to your store (read-only)' })
  @ApiParam({ name: 'offerId', type: String, format: 'uuid' })
  @Get(':offerId')
  getOne(
    @EffectiveMerchantId() merchantId: string,
    @Param('offerId', ParseUUIDPipe) offerId: string,
  ) {
    return this.offers.findOneForMerchant(merchantId, offerId);
  }
}
