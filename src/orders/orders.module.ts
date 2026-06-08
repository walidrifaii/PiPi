import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { TrackingModule } from '../tracking/tracking.module';
import { PlatformSettingsModule } from '../platform-settings/platform-settings.module';
import { NotificationsService } from '../notifications/notifications.service';
import { OrderNotificationsPort } from '../notifications/notifications.port';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminOrdersController } from './admin-orders.controller';
import { MerchantOrdersController } from './merchant-orders.controller';
import { OrdersService } from './orders.service';
import { UserOrdersController } from './user-orders.controller';
import { DriverOrdersController } from './driver-orders.controller';
import { DriverEarningsController } from './driver-earnings.controller';
import { MerchantEarningsController } from './merchant-earnings.controller';
import { AdminDriverEarningsController } from './admin-driver-earnings.controller';
import { AdminMerchantEarningsController } from './admin-merchant-earnings.controller';
import { DriverOrdersService } from './driver-orders.service';
import { EarningsSettlementsService } from './earnings-settlements.service';
import {
  AdminDriverEarningsV2Controller,
  AdminMerchantEarningsV2Controller,
  AdminOrdersV2Controller,
  DriverEarningsV2Controller,
  DriverOrdersV2Controller,
  MerchantEarningsV2Controller,
  MerchantOrdersV2Controller,
  UserOrdersV2Controller,
} from '../v2/controllers/feature.v2-controllers';

@Module({
  imports: [PrismaModule, NotificationsModule, TrackingModule, PlatformSettingsModule],
  controllers: [
    UserOrdersController,
    MerchantOrdersController,
    AdminOrdersController,
    DriverOrdersController,
    DriverEarningsController,
    MerchantEarningsController,
    AdminDriverEarningsController,
    AdminMerchantEarningsController,
    UserOrdersV2Controller,
    MerchantOrdersV2Controller,
    AdminOrdersV2Controller,
    DriverOrdersV2Controller,
    DriverEarningsV2Controller,
    MerchantEarningsV2Controller,
    AdminDriverEarningsV2Controller,
    AdminMerchantEarningsV2Controller,
  ],
  providers: [
    OrdersService,
    DriverOrdersService,
    EarningsSettlementsService,
    {
      provide: OrderNotificationsPort,
      useExisting: NotificationsService,
    },
  ],
  exports: [OrdersService, DriverOrdersService],
})
export class OrdersModule {}
