import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { MerchantOfferAdminController } from './merchant-offer-admin.controller';
import { MerchantOfferMerchantController } from './merchant-offer-merchant.controller';
import { MerchantOfferService } from './merchant-offer.service';

@Module({
  imports: [PrismaModule],
  controllers: [
    MerchantOfferAdminController,
    MerchantOfferMerchantController,
  ],
  providers: [MerchantOfferService],
  exports: [MerchantOfferService],
})
export class MerchantOfferModule {}
