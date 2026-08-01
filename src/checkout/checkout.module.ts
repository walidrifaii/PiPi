import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { NotificationsService } from '../notifications/notifications.service';
import { OrderNotificationsPort } from '../notifications/notifications.port';
import { DeliveryFeeModule } from '../delivery-fee/delivery-fee.module';
import { MerchantOfferModule } from '../merchant-offer/merchant-offer.module';
import { PrismaModule } from '../prisma/prisma.module';
import { CouponModule } from '../coupon/coupon.module';
import { CheckoutController } from './checkout.controller';
import { CheckoutService } from './checkout.service';
import { UserAddressController } from './user-address.controller';
import { UserAddressService } from './user-address.service';
import {
  CheckoutV2Controller,
  UserAddressV2Controller,
} from '../v2/controllers/feature.v2-controllers';
import { CheckoutV3Controller } from '../v3/checkout/checkout-v3.controller';
import { UserAddressV3Controller } from '../v3/checkout/user-address-v3.controller';
import { UserAddressV3Service } from '../v3/checkout/user-address-v3.service';

@Module({
  imports: [
    PrismaModule,
    NotificationsModule,
    MerchantOfferModule,
    DeliveryFeeModule,
    CouponModule,
  ],
  controllers: [
    CheckoutController,
    UserAddressController,
    CheckoutV2Controller,
    UserAddressV2Controller,
    CheckoutV3Controller,
    UserAddressV3Controller,
  ],
  providers: [
    CheckoutService,
    UserAddressService,
    UserAddressV3Service,
    {
      provide: OrderNotificationsPort,
      useExisting: NotificationsService,
    },
  ],
})
export class CheckoutModule {}
