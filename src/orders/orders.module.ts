import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { MerchantOrdersController } from './merchant-orders.controller';
import { OrdersService } from './orders.service';
import { UserOrdersController } from './user-orders.controller';

@Module({
  imports: [PrismaModule],
  controllers: [UserOrdersController, MerchantOrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
