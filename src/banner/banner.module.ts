import { Module } from '@nestjs/common';
import { CloudinaryService } from '../common/cloudinary.service';
import { PrismaModule } from '../prisma/prisma.module';
import { BannerAdminController } from './banner-admin.controller';
import { BannerController } from './banner.controller';
import { BannerService } from './banner.service';

@Module({
  imports: [PrismaModule],
  controllers: [BannerController, BannerAdminController],
  providers: [BannerService, CloudinaryService],
  exports: [BannerService],
})
export class BannerModule {}
