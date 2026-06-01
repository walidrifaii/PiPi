import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { DeliveryFeeService } from './delivery-fee.service';
import { QuoteDeliveryFeeQueryDto } from './dto/quote-delivery-fee-query.dto';

@ApiTags('Storefront')
@Controller('delivery-fees')
export class DeliveryFeePublicController {
  constructor(private readonly deliveryFees: DeliveryFeeService) {}

  @ApiOperation({
    summary:
      'Active delivery fee (includedKm, maxKm, maxFee) and sampleBreakdown',
  })
  @Get('active')
  getActive() {
    return this.deliveryFees.getActiveConfig();
  }

  @ApiOperation({
    summary:
      'Quote total deliveryFee for a trip (distanceKm or lat/lng). Returns rates + deliveryFee only.',
  })
  @Get('quote')
  quote(@Query() query: QuoteDeliveryFeeQueryDto) {
    return this.deliveryFees.quote(query);
  }
}
