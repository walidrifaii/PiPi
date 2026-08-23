import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { NotificationsService } from '../notifications/notifications.service';
import { OrderNotificationsPort } from '../notifications/notifications.port';
import { PlatformSettingsModule } from '../platform-settings/platform-settings.module';
import { PrismaModule } from '../prisma/prisma.module';
import { DriverPickupsService } from './driver-pickups.service';
import { PickupBlockedZoneService } from './pickup-blocked-zone.service';
import { PickupDeliveryFeeService } from './pickup-delivery-fee.service';
import { PickupService } from './pickup.service';
import { PickupSettingsService } from './pickup-settings.service';
import {
  DriverPickupsV3Controller,
  PickupAdminV3Controller,
  PickupV3Controller,
  UserPickupsV3Controller,
} from '../v3/controllers/feature.v3-controllers';

/** Pickup courier APIs are v3-only — not mounted on v1 or v2. */
@Module({
  imports: [PrismaModule, NotificationsModule, PlatformSettingsModule],
  controllers: [
    UserPickupsV3Controller,
    PickupV3Controller,
    DriverPickupsV3Controller,
    PickupAdminV3Controller,
  ],
  providers: [
    PickupSettingsService,
    PickupDeliveryFeeService,
    PickupBlockedZoneService,
    PickupService,
    DriverPickupsService,
    {
      provide: OrderNotificationsPort,
      useExisting: NotificationsService,
    },
  ],
  exports: [
    PickupService,
    PickupBlockedZoneService,
    PickupSettingsService,
    PickupDeliveryFeeService,
  ],
})
export class PickupModule {}
