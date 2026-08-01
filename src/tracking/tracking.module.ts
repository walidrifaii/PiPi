import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { TrackingController } from './tracking.controller';
import { TrackingService } from './tracking.service';
import { DriverOffersLiveService } from './driver-offers-live.service';
import { OrderChatService } from './order-chat.service';
import { OrderCallService } from './order-call.service';
import { TrackingV2Controller } from '../v2/controllers/feature.v2-controllers';
import { TrackingV3Controller } from '../v3/controllers/feature.v3-controllers';

@Module({
  imports: [PrismaModule, AuthModule, NotificationsModule],
  controllers: [TrackingController, TrackingV2Controller, TrackingV3Controller],
  providers: [
    TrackingService,
    DriverOffersLiveService,
    OrderChatService,
    OrderCallService,
  ],
  exports: [
    TrackingService,
    DriverOffersLiveService,
    OrderChatService,
    OrderCallService,
  ],
})
export class TrackingModule {}
