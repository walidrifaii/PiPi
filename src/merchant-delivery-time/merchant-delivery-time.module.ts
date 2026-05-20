import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { MerchantDeliveryTimeController } from './merchant-delivery-time.controller';
import { MerchantDeliveryTimeService } from './merchant-delivery-time.service';

@Module({
  imports: [PrismaModule],
  controllers: [MerchantDeliveryTimeController],
  providers: [MerchantDeliveryTimeService],
  exports: [MerchantDeliveryTimeService],
})
export class MerchantDeliveryTimeModule {}
