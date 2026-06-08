import { Module } from '@nestjs/common';
import { CloudinaryService } from '../common/cloudinary.service';
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
  providers: [BannerService, CloudinaryService],
  exports: [BannerService],
})
export class BannerModule {}
