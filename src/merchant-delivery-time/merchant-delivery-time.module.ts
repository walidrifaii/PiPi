import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { MerchantDeliveryTimeController } from './merchant-delivery-time.controller';
import { MerchantDeliveryTimeService } from './merchant-delivery-time.service';
import { MerchantDeliveryTimeV2Controller } from '../v2/controllers/feature.v2-controllers';
import { MerchantDeliveryTimeV3Controller } from '../v3/controllers/feature.v3-controllers';

@Module({
  imports: [PrismaModule],
  controllers: [
    MerchantDeliveryTimeController,
    MerchantDeliveryTimeV2Controller,
    MerchantDeliveryTimeV3Controller,
  ],
  providers: [MerchantDeliveryTimeService],
  exports: [MerchantDeliveryTimeService],
})
export class MerchantDeliveryTimeModule {}
