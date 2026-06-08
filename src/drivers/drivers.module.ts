import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { DriversController } from './drivers.controller';
import { DriversService } from './drivers.service';
import { DriversV2Controller } from '../v2/controllers/feature.v2-controllers';

@Module({
  imports: [PrismaModule],
  controllers: [DriversController, DriversV2Controller],
  providers: [DriversService],
  exports: [DriversService],
})
export class DriversModule {}
