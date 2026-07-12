import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { S3Service } from '../common/s3.service';
import { BundleService } from './bundle.service';

@Module({
  imports: [PrismaModule],
  // Controllers are registered in AppModule / APP_V2_CONTROLLERS so
  // `me/bundles` is mounted before public `:merchantId/bundles`.
  providers: [BundleService, S3Service],
  exports: [BundleService],
})
export class BundleModule {}
