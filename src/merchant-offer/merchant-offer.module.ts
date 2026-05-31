import { Module } from '@nestjs/common';
import { CloudinaryService } from '../common/cloudinary.service';
import { PrismaModule } from '../prisma/prisma.module';
import { MerchantOfferAdminController } from './merchant-offer-admin.controller';
import { MerchantOfferMerchantController } from './merchant-offer-merchant.controller';
import { MerchantOfferPublicController } from './merchant-offer-public.controller';
import { MerchantOfferService } from './merchant-offer.service';

@Module({
  imports: [PrismaModule],
  controllers: [
    MerchantOfferAdminController,
    MerchantOfferMerchantController,
    MerchantOfferPublicController,
  ],
  providers: [MerchantOfferService, CloudinaryService],
  exports: [MerchantOfferService],
})
export class MerchantOfferModule {}
