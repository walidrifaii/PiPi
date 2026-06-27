import { Module } from '@nestjs/common';
import { S3Service } from '../common/s3.service';
import { PrismaModule } from '../prisma/prisma.module';
import { MerchantTypeController } from './merchant-type.controller';
import { MerchantTypeService } from './merchant-type.service';
import { MerchantTypeV2Controller } from '../v2/controllers/feature.v2-controllers';

@Module({
  imports: [PrismaModule],
  controllers: [MerchantTypeController, MerchantTypeV2Controller],
  providers: [MerchantTypeService, S3Service],
  exports: [MerchantTypeService],
})
export class MerchantTypeModule {}
