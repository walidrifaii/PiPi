import { Module } from '@nestjs/common';
import { FirebaseAdminModule } from '../firebase/firebase-admin.module';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { UserNotificationsController } from './user-notifications.controller';
import { UserNotificationsService } from './user-notifications.service';

@Module({
  imports: [FirebaseAdminModule, PrismaModule],
  controllers: [NotificationsController, UserNotificationsController],
  providers: [NotificationsService, UserNotificationsService],
  exports: [NotificationsService, UserNotificationsService],
})
export class NotificationsModule {}
