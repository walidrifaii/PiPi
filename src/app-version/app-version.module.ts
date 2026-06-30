import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AppVersionService } from './app-version.service';
import { AppVersionController } from './app-version.controller';
import { AppVersionAdminController } from './app-version-admin.controller';

@Module({
  imports: [PrismaModule],
  controllers: [AppVersionController, AppVersionAdminController],
  providers: [AppVersionService],
  exports: [AppVersionService],
})
export class AppVersionModule {}
