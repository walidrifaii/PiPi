import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { QuoteDeliveryFeeQueryDto } from '../../delivery-fee/dto/quote-delivery-fee-query.dto';
import { DeliveryFeeV2Service } from '../../v2/delivery-fee/delivery-fee-v2.service';
import { DeliveryFeeV2ActiveResponseDto } from '../../v2/delivery-fee/dto/delivery-fee-v2-response.dto';

@ApiTags('V3 · Storefront')
@Controller({ path: 'delivery-fees', version: '3' })
export class DeliveryFeePublicV3Controller {
  constructor(private readonly deliveryFeesV3: DeliveryFeeV2Service) {}

  @ApiOperation({
    summary: 'Active delivery fee config (v3)',
  })
  @Get('active')
  getActive(): Promise<DeliveryFeeV2ActiveResponseDto> {
    return this.deliveryFeesV3.getActiveConfig();
  }

  @ApiOperation({
    summary: 'Quote delivery fee (v3)',
  })
  @Get('quote')
  quote(@Query() query: QuoteDeliveryFeeQueryDto) {
    return this.deliveryFeesV3.quote(query);
  }
}
