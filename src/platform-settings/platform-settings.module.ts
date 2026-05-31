import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PlatformSettingsService } from './platform-settings.service';
import { PlatformSettingsAdminController } from './platform-settings-admin.controller';

@Module({
  imports: [PrismaModule],
  controllers: [PlatformSettingsAdminController],
  providers: [PlatformSettingsService],
  exports: [PlatformSettingsService],
})
export class PlatformSettingsModule {}
