import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DriversModule } from '../drivers/drivers.module';
import { UsersModule } from '../users/users.module';
import { SuperAdminPlatformController } from './super-admin-platform.controller';
import { SuperAdminPlatformV2Controller } from '../v2/controllers/feature.v2-controllers';
import { SuperAdminPlatformV3Controller } from '../v3/controllers/feature.v3-controllers';

@Module({
  imports: [AuthModule, UsersModule, DriversModule],
  controllers: [
    SuperAdminPlatformController,
    SuperAdminPlatformV2Controller,
    SuperAdminPlatformV3Controller,
  ],
})
export class AdminModule {}
