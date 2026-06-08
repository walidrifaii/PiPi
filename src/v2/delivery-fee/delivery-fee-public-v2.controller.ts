import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags, ApiTooManyRequestsResponse } from '@nestjs/swagger';
import { QuoteDeliveryFeeQueryDto } from '../../delivery-fee/dto/quote-delivery-fee-query.dto';
import { DeliveryFeeV2Service } from './delivery-fee-v2.service';
import {
  DeliveryFeeV2ActiveResponseDto,
  DeliveryFeeV2QuoteResponseDto,
} from './dto/delivery-fee-v2-response.dto';

@ApiTags('Storefront V2')
@ApiTooManyRequestsResponse({
  description:
    'Rate limit exceeded for v2 (per IP or authenticated user). Retry after Retry-After header.',
})
@Controller({ path: 'delivery-fees', version: '2' })
export class DeliveryFeePublicV2Controller {
  constructor(private readonly deliveryFeesV2: DeliveryFeeV2Service) {}

  @ApiOperation({
    summary: 'Active delivery fee config (v2)',
    description:
      'Returns rates and limits grouped for v2 clients. v1 GET /delivery-fees/active is unchanged.',
  })
  @Get('active')
  getActive(): Promise<DeliveryFeeV2ActiveResponseDto> {
    return this.deliveryFeesV2.getActiveConfig();
  }

  @ApiOperation({
    summary: 'Quote delivery fee (v2)',
    description:
      'Same query params as v1, with grouped quote breakdown and distanceKm when available.',
  })
  @Get('quote')
  quote(
    @Query() query: QuoteDeliveryFeeQueryDto,
  ): Promise<DeliveryFeeV2QuoteResponseDto> {
    return this.deliveryFeesV2.quote(query);
  }
}
