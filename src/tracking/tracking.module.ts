import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { TrackingController } from './tracking.controller';
import { TrackingService } from './tracking.service';
import { OrderChatService } from './order-chat.service';

@Module({
  imports: [PrismaModule, AuthModule, NotificationsModule],
  controllers: [TrackingController],
  providers: [TrackingService, OrderChatService],
  exports: [TrackingService, OrderChatService],
})
export class TrackingModule {}
