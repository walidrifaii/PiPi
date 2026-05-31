import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { AppController } from './app.controller';
import { MerchantController } from './merchant.controller';
import { AppService } from './app.service';
import { CloudinaryService } from './common/cloudinary.service';
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
import { MerchantOfferPublicController } from './merchant-offer/merchant-offer-public.controller';

@Module({
  imports: [
    PrismaModule,
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
  ],
  controllers: [
    AppController,
    // Before MerchantController so `/merchants/me/*` and `/merchants/:id/offers` are not captured by `:merchantId`.
    MerchantCatalogController,
    MerchantOfferPublicController,
    MerchantController,
    MerchantCatalogSuperAdminController,
  ],
  providers: [
    AppService,
    MerchantIntegrationService,
    MerchantCatalogService,
    CloudinaryService,
  ],
})
export class AppModule {}
