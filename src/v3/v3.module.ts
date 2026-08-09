import { Module } from '@nestjs/common';
import { DeliveryFeeModule } from '../delivery-fee/delivery-fee.module';
import { DeliveryFeeV2Service } from '../v2/delivery-fee/delivery-fee-v2.service';
import { DeliveryFeePublicV3Controller } from './delivery-fee/delivery-fee-public-v3.controller';
import { ProductOptionsV3Module } from './product-options/product-options-v3.module';

@Module({
  imports: [DeliveryFeeModule, ProductOptionsV3Module],
  controllers: [DeliveryFeePublicV3Controller],
  providers: [DeliveryFeeV2Service],
})
export class V3Module {}
