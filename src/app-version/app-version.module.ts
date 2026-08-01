import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AppVersionService } from './app-version.service';
import { AppVersionController } from './app-version.controller';
import { AppVersionAdminController } from './app-version-admin.controller';
import {
  AppVersionAdminV3Controller,
  AppVersionV3Controller,
} from '../v3/controllers/feature.v3-controllers';

@Module({
  imports: [PrismaModule],
  controllers: [
    AppVersionController,
    AppVersionAdminController,
    AppVersionV3Controller,
    AppVersionAdminV3Controller,
  ],
  providers: [AppVersionService],
  exports: [AppVersionService],
})
export class AppVersionModule {}
