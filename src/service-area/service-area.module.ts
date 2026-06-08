import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ServiceAreaController } from './service-area.controller';
import { ServiceAreaService } from './service-area.service';
import { ServiceAreaV2Controller } from '../v2/controllers/feature.v2-controllers';

@Module({
  imports: [PrismaModule],
  controllers: [ServiceAreaController, ServiceAreaV2Controller],
  providers: [ServiceAreaService],
  exports: [ServiceAreaService],
})
export class ServiceAreaModule {}
