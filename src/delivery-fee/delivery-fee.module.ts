import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { DeliveryFeeAdminController } from './delivery-fee-admin.controller';
import { DeliveryFeePublicController } from './delivery-fee-public.controller';
import { DeliveryFeeService } from './delivery-fee.service';

@Module({
  imports: [PrismaModule],
  controllers: [DeliveryFeePublicController, DeliveryFeeAdminController],
  providers: [DeliveryFeeService],
  exports: [DeliveryFeeService],
})
export class DeliveryFeeModule {}
