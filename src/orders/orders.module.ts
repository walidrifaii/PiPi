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
import { DriverOrdersController } from './driver-orders.controller';
import { DriverOrdersService } from './driver-orders.service';

@Module({
  imports: [PrismaModule, NotificationsModule, TrackingModule],
  controllers: [
    UserOrdersController,
    MerchantOrdersController,
    AdminOrdersController,
    DriverOrdersController,
  ],
  providers: [
    OrdersService,
    DriverOrdersService,
    {
      provide: OrderNotificationsPort,
      useExisting: NotificationsService,
    },
  ],
  exports: [OrdersService, DriverOrdersService],
})
export class OrdersModule {}
