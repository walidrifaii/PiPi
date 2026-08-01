import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { DeliveryFeeAdminController } from './delivery-fee-admin.controller';
import { DeliveryFeePublicController } from './delivery-fee-public.controller';
import { DeliveryFeeService } from './delivery-fee.service';
import { DeliveryFeeAdminV2Controller } from '../v2/controllers/feature.v2-controllers';
import { DeliveryFeeAdminV3Controller } from '../v3/controllers/feature.v3-controllers';

@Module({
  imports: [PrismaModule],
  controllers: [
    DeliveryFeePublicController,
    DeliveryFeeAdminController,
    DeliveryFeeAdminV2Controller,
    DeliveryFeeAdminV3Controller,
  ],
  providers: [DeliveryFeeService],
  exports: [DeliveryFeeService],
})
export class DeliveryFeeModule {}
