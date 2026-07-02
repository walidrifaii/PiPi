import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { S3Service } from '../common/s3.service';
import { BundleMerchantController } from './bundle-merchant.controller';
import { BundleMerchantPublicController } from './bundle-public.controller';
import { BundleService } from './bundle.service';
import {
  BundleMerchantV2Controller,
  BundleMerchantPublicV2Controller,
} from '../v2/controllers/feature.v2-controllers';

@Module({
  imports: [PrismaModule],
  controllers: [
    BundleMerchantController,
    BundleMerchantV2Controller,
    BundleMerchantPublicController,
    BundleMerchantPublicV2Controller,
  ],
  providers: [BundleService, S3Service],
  exports: [BundleService],
})
export class BundleModule {}
