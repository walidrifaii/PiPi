import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { AppController } from './app.controller';
import { MerchantController } from './merchant.controller';
import { AppService } from './app.service';
import { AppRedisModule } from './common/app-redis.module';
import { S3Service } from './common/s3.service';
import { MerchantCatalogController } from './merchant-catalog/merchant-catalog.controller';
import { MerchantCatalogSuperAdminController } from './merchant-catalog/merchant-catalog-super-admin.controller';
import { MerchantCatalogService } from './merchant-catalog/merchant-catalog.service';
import { PrismaModule } from './prisma/prisma.module';
import { MerchantIntegrationService } from './merchant.integration.service';
import { MerchantTypeModule } from './merchant-type/merchant-type.module';
import { AdminModule } from './admin/admin.module';
import { DriversModule } from './drivers/drivers.module';
import { UsersModule } from './users/users.module';
import { ServiceAreaModule } from './service-area/service-area.module';
import { BannerModule } from './banner/banner.module';
import { CheckoutModule } from './checkout/checkout.module';
import { OrdersModule } from './orders/orders.module';
import { MerchantDeliveryTimeModule } from './merchant-delivery-time/merchant-delivery-time.module';
import { NotificationsModule } from './notifications/notifications.module';
import { FirebaseAdminModule } from './firebase/firebase-admin.module';
import { TrackingModule } from './tracking/tracking.module';
import { MerchantOfferModule } from './merchant-offer/merchant-offer.module';
import { MerchantOfferAdminController } from './merchant-offer/merchant-offer-admin.controller';
import { MerchantOfferPublicController } from './merchant-offer/merchant-offer-public.controller';
import { PlatformSettingsModule } from './platform-settings/platform-settings.module';
import { DeliveryFeeModule } from './delivery-fee/delivery-fee.module';
import { GeoModule } from './geo/geo.module';
import { V2Module } from './v2/v2.module';
import { V3Module } from './v3/v3.module';
import { APP_V2_CONTROLLERS } from './v2/controllers/app.v2-controllers';
import { APP_V3_CONTROLLERS } from './v3/controllers/app.v3-controllers';
import { AppVersionModule } from './app-version/app-version.module';
import { CouponModule } from './coupon/coupon.module';
import { BundleModule } from './bundle/bundle.module';
import { PickupModule } from './pickup/pickup.module';
import { BundleAdminController } from './bundle/bundle-admin.controller';
import { BundleMerchantController } from './bundle/bundle-merchant.controller';
import {
  BundlePublicController,
  BundleMerchantPublicController,
} from './bundle/bundle-public.controller';

@Module({
  imports: [
    PrismaModule,
    AppRedisModule,
    GeoModule,
    FirebaseAdminModule,
    AuthModule,
    MerchantTypeModule,
    UsersModule,
    DriversModule,
    AdminModule,
    ServiceAreaModule,
    BannerModule,
    CheckoutModule,
    OrdersModule,
    MerchantDeliveryTimeModule,
    NotificationsModule,
    TrackingModule,
    MerchantOfferModule,
    PlatformSettingsModule,
    DeliveryFeeModule,
    AppVersionModule,
    CouponModule,
    BundleModule,
    PickupModule,
    V2Module,
    V3Module,
  ],
  controllers: [
    AppController,
    // Before MerchantController so `/merchants/me/*` and `/merchants/:id/offers` are not captured by `:merchantId`.
    MerchantCatalogController,
    // Before MerchantOfferPublicController / BundleMerchantPublicController so
    // `/merchants/admin/*` is not captured as `:merchantId=admin` (and `me` similarly).
    MerchantOfferAdminController,
    BundleAdminController,
    MerchantOfferPublicController,
    BundlePublicController,
    // Static `me/bundles` before public `:merchantId/bundles` (same controller prefix).
    BundleMerchantController,
    BundleMerchantPublicController,
    MerchantController,
    MerchantCatalogSuperAdminController,
    ...APP_V2_CONTROLLERS,
    ...APP_V3_CONTROLLERS,
  ],
  providers: [
    AppService,
    MerchantIntegrationService,
    MerchantCatalogService,
    S3Service,
  ],
})
export class AppModule {}
