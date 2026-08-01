import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { UsersV2Controller } from '../v2/controllers/feature.v2-controllers';
import { UsersV3Controller } from '../v3/controllers/feature.v3-controllers';

@Module({
  imports: [PrismaModule],
  controllers: [UsersController, UsersV2Controller, UsersV3Controller],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
