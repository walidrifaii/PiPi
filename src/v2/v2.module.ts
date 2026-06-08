import { Module } from '@nestjs/common';
import { DeliveryFeeModule } from '../delivery-fee/delivery-fee.module';
import { DeliveryFeePublicV2Controller } from './delivery-fee/delivery-fee-public-v2.controller';
import { DeliveryFeeV2Service } from './delivery-fee/delivery-fee-v2.service';
import { V2ThrottleModule } from './throttling/v2-throttle.module';

@Module({
  imports: [DeliveryFeeModule, V2ThrottleModule],
  controllers: [DeliveryFeePublicV2Controller],
  providers: [DeliveryFeeV2Service],
})
export class V2Module {}
