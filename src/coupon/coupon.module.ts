import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CouponService } from './coupon.service';
import { CouponAdminController } from './coupon-admin.controller';
import { CouponPublicController } from './coupon-public.controller';
import {
  CouponAdminV3Controller,
  CouponPublicV3Controller,
} from '../v3/controllers/feature.v3-controllers';

@Module({
  imports: [PrismaModule],
  controllers: [
    CouponAdminController,
    CouponPublicController,
    CouponAdminV3Controller,
    CouponPublicV3Controller,
  ],
  providers: [CouponService],
  exports: [CouponService],
})
export class CouponModule {}
