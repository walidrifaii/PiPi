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

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    MerchantTypeModule,
    UsersModule,
    DriversModule,
    AdminModule,
    ServiceAreaModule,
    BannerModule,
  ],
  controllers: [
    AppController,
    // Before MerchantController so `/merchants/me/*` is not captured by `:merchantId/*`.
    MerchantCatalogController,
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
