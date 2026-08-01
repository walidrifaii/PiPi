import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ServiceAreaController } from './service-area.controller';
import { ServiceAreaService } from './service-area.service';
import { ServiceAreaV2Controller } from '../v2/controllers/feature.v2-controllers';
import { ServiceAreaV3Controller } from '../v3/controllers/feature.v3-controllers';

@Module({
  imports: [PrismaModule],
  controllers: [ServiceAreaController, ServiceAreaV2Controller, ServiceAreaV3Controller],
  providers: [ServiceAreaService],
  exports: [ServiceAreaService],
})
export class ServiceAreaModule {}
