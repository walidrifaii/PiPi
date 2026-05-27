import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { TrackingModule } from '../tracking/tracking.module';
import { NotificationsService } from '../notifications/notifications.service';
import { OrderNotificationsPort } from '../notifications/notifications.port';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminOrdersController } from './admin-orders.controller';
import { MerchantOrdersController } from './merchant-orders.controller';
import { OrdersService } from './orders.service';
import { UserOrdersController } from './user-orders.controller';

@Module({
  imports: [PrismaModule, NotificationsModule, TrackingModule],
  controllers: [
    UserOrdersController,
    MerchantOrdersController,
    AdminOrdersController,
  ],
  providers: [
    OrdersService,
    {
      provide: OrderNotificationsPort,
      useExisting: NotificationsService,
    },
  ],
  exports: [OrdersService],
})
export class OrdersModule {}
