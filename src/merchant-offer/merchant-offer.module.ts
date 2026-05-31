import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { MerchantOfferMerchantController } from './merchant-offer-merchant.controller';
import { MerchantOfferService } from './merchant-offer.service';

@Module({
  imports: [PrismaModule],
  controllers: [MerchantOfferMerchantController],
  providers: [MerchantOfferService],
  exports: [MerchantOfferService],
})
export class MerchantOfferModule {}
