import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { MerchantOfferModule } from '../../merchant-offer/merchant-offer.module';
import { MerchantCatalogService } from '../../merchant-catalog/merchant-catalog.service';
import { S3Service } from '../../common/s3.service';
import { ProductOptionsV3Service } from './product-options-v3.service';
import {
  MerchantProductOptionsV3Controller,
  ProductOptionsStorefrontV3Controller,
} from './product-options-v3.controller';

@Module({
  imports: [PrismaModule, MerchantOfferModule],
  controllers: [
    ProductOptionsStorefrontV3Controller,
    MerchantProductOptionsV3Controller,
  ],
  providers: [ProductOptionsV3Service, MerchantCatalogService, S3Service],
})
export class ProductOptionsV3Module {}
