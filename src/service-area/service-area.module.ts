import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ServiceAreaController } from './service-area.controller';
import { ServiceAreaService } from './service-area.service';

@Module({
  imports: [PrismaModule],
  controllers: [ServiceAreaController],
  providers: [ServiceAreaService],
  exports: [ServiceAreaService],
})
export class ServiceAreaModule {}
