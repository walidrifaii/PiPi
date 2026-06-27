import { Module } from '@nestjs/common';
import { S3Service } from '../common/s3.service';
import { PrismaModule } from '../prisma/prisma.module';
import { BannerAdminController } from './banner-admin.controller';
import { BannerController } from './banner.controller';
import { BannerService } from './banner.service';
import {
  BannerAdminV2Controller,
  BannerV2Controller,
} from '../v2/controllers/feature.v2-controllers';

@Module({
  imports: [PrismaModule],
  controllers: [
    BannerController,
    BannerAdminController,
    BannerV2Controller,
    BannerAdminV2Controller,
  ],
  providers: [BannerService, S3Service],
  exports: [BannerService],
})
export class BannerModule {}
