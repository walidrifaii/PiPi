import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { S3Service } from '../common/s3.service';
import { BundleMerchantController } from './bundle-merchant.controller';
import { BundleService } from './bundle.service';
import { BundleMerchantV2Controller } from '../v2/controllers/feature.v2-controllers';

@Module({
  imports: [PrismaModule],
  // Merchant `me/bundles` only — public `:merchantId/bundles` is registered in
  // AppModule / APP_V2_CONTROLLERS after this module so `me` is not captured as a UUID.
  controllers: [BundleMerchantController, BundleMerchantV2Controller],
  providers: [BundleService, S3Service],
  exports: [BundleService],
})
export class BundleModule {}
