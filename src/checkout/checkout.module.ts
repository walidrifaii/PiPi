import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { NotificationsService } from '../notifications/notifications.service';
import { OrderNotificationsPort } from '../notifications/notifications.port';
import { DeliveryFeeModule } from '../delivery-fee/delivery-fee.module';
import { MerchantOfferModule } from '../merchant-offer/merchant-offer.module';
import { PlatformSettingsModule } from '../platform-settings/platform-settings.module';
import { PrismaModule } from '../prisma/prisma.module';
import { CheckoutController } from './checkout.controller';
import { CheckoutService } from './checkout.service';
import { UserAddressController } from './user-address.controller';
import { UserAddressService } from './user-address.service';
import {
  CheckoutV2Controller,
  UserAddressV2Controller,
} from '../v2/controllers/feature.v2-controllers';

@Module({
  imports: [
    PrismaModule,
    NotificationsModule,
    MerchantOfferModule,
    DeliveryFeeModule,
    PlatformSettingsModule,
  ],
  controllers: [
    CheckoutController,
    UserAddressController,
    CheckoutV2Controller,
    UserAddressV2Controller,
  ],
  providers: [
    CheckoutService,
    UserAddressService,
    {
      provide: OrderNotificationsPort,
      useExisting: NotificationsService,
    },
  ],
})
export class CheckoutModule {}
