import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PlatformSettingsService } from './platform-settings.service';
import { PlatformSettingsAdminController } from './platform-settings-admin.controller';
import { PlatformOperatingController } from './platform-operating.controller';
import { PlatformSettingsAdminV2Controller } from '../v2/controllers/feature.v2-controllers';

@Module({
  imports: [PrismaModule],
  controllers: [
    PlatformSettingsAdminController,
    PlatformOperatingController,
    PlatformSettingsAdminV2Controller,
  ],
  providers: [PlatformSettingsService],
  exports: [PlatformSettingsService],
})
export class PlatformSettingsModule {}
