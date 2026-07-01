import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CouponService } from './coupon.service';
import { CouponAdminController } from './coupon-admin.controller';
import { CouponPublicController } from './coupon-public.controller';

@Module({
  imports: [PrismaModule],
  controllers: [CouponAdminController, CouponPublicController],
  providers: [CouponService],
  exports: [CouponService],
})
export class CouponModule {}
