import { Module } from '@nestjs/common';
import { FirebaseAdminModule } from '../firebase/firebase-admin.module';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationBroadcastAdminController } from './notification-broadcast-admin.controller';
import { NotificationBroadcastService } from './notification-broadcast.service';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { UserNotificationsController } from './user-notifications.controller';
import { UserNotificationsService } from './user-notifications.service';
import {
  NotificationBroadcastAdminV2Controller,
  NotificationsV2Controller,
  UserNotificationsV2Controller,
} from '../v2/controllers/feature.v2-controllers';

@Module({
  imports: [FirebaseAdminModule, PrismaModule],
  controllers: [
    NotificationsController,
    UserNotificationsController,
    NotificationBroadcastAdminController,
    NotificationsV2Controller,
    UserNotificationsV2Controller,
    NotificationBroadcastAdminV2Controller,
  ],
  providers: [
    NotificationsService,
    UserNotificationsService,
    NotificationBroadcastService,
  ],
  exports: [
    NotificationsService,
    UserNotificationsService,
    NotificationBroadcastService,
  ],
})
export class NotificationsModule {}
