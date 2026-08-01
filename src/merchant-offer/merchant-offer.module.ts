import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { MerchantOfferMerchantController } from './merchant-offer-merchant.controller';
import { MerchantOfferService } from './merchant-offer.service';
import { MerchantOfferMerchantV2Controller } from '../v2/controllers/feature.v2-controllers';
import { MerchantOfferMerchantV3Controller } from '../v3/controllers/feature.v3-controllers';

@Module({
  imports: [PrismaModule],
  controllers: [
    MerchantOfferMerchantController,
    MerchantOfferMerchantV2Controller,
    MerchantOfferMerchantV3Controller,
  ],
  providers: [MerchantOfferService],
  exports: [MerchantOfferService],
})
export class MerchantOfferModule {}
