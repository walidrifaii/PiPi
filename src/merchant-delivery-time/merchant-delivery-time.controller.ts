import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { EffectiveMerchantId } from '../auth/effective-merchant-id.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { MerchantJwtScopeGuard } from '../auth/merchant-jwt-scope.guard';
import { UpsertMerchantDeliveryTimeDto } from './dto/upsert-merchant-delivery-time.dto';
import { MerchantDeliveryTimeService } from './merchant-delivery-time.service';

@ApiTags('Merchant')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, MerchantJwtScopeGuard)
@Controller('merchants/me/delivery-time')
export class MerchantDeliveryTimeController {
  constructor(
    private readonly deliveryTimeService: MerchantDeliveryTimeService,
  ) {}

  @ApiOperation({
    summary: 'Get your store delivery time range (min/max minutes)',
  })
  @Get()
  get(@EffectiveMerchantId() merchantId: string) {
    return this.deliveryTimeService.getForMerchant(merchantId);
  }

  @ApiOperation({
    summary: 'Save delivery time range (min/max minutes); creates or updates',
  })
  @Put()
  upsert(
    @EffectiveMerchantId() merchantId: string,
    @Body() dto: UpsertMerchantDeliveryTimeDto,
  ) {
    return this.deliveryTimeService.upsertForMerchant(merchantId, dto);
  }
}
