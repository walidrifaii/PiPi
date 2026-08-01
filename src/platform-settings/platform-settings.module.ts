import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PlatformSettingsService } from './platform-settings.service';
import { PlatformSettingsAdminController } from './platform-settings-admin.controller';
import { PlatformSettingsAdminV2Controller } from '../v2/controllers/feature.v2-controllers';
import { PlatformSettingsAdminV3Controller } from '../v3/controllers/feature.v3-controllers';

@Module({
  imports: [PrismaModule],
  controllers: [
    PlatformSettingsAdminController,
    PlatformSettingsAdminV2Controller,
    PlatformSettingsAdminV3Controller,
  ],
  providers: [PlatformSettingsService],
  exports: [PlatformSettingsService],
})
export class PlatformSettingsModule {}
