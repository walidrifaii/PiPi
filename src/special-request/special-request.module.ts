import { Module } from '@nestjs/common';
import { S3Service } from '../common/s3.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { NotificationsService } from '../notifications/notifications.service';
import { OrderNotificationsPort } from '../notifications/notifications.port';
import { PickupModule } from '../pickup/pickup.module';
import { PlatformSettingsModule } from '../platform-settings/platform-settings.module';
import { PrismaModule } from '../prisma/prisma.module';
import { DriverSpecialRequestsService } from './driver-special-requests.service';
import { SpecialRequestService } from './special-request.service';
import { SpecialRequestSettingsService } from './special-request-settings.service';
import {
  DriverSpecialRequestsV3Controller,
  SpecialRequestAdminV3Controller,
  SpecialRequestV3Controller,
  UserSpecialRequestsV3Controller,
} from '../v3/controllers/feature.v3-controllers';

/** Special request APIs are v3-only — not mounted on v1 or v2. */
@Module({
  imports: [
    PrismaModule,
    NotificationsModule,
    PlatformSettingsModule,
    PickupModule,
  ],
  controllers: [
    UserSpecialRequestsV3Controller,
    SpecialRequestV3Controller,
    DriverSpecialRequestsV3Controller,
    SpecialRequestAdminV3Controller,
  ],
  providers: [
    SpecialRequestService,
    SpecialRequestSettingsService,
    DriverSpecialRequestsService,
    S3Service,
    {
      provide: OrderNotificationsPort,
      useExisting: NotificationsService,
    },
  ],
  exports: [SpecialRequestService],
})
export class SpecialRequestModule {}
