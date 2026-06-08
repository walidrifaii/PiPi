import { Module } from '@nestjs/common';
import { CloudinaryService } from '../common/cloudinary.service';
import { PrismaModule } from '../prisma/prisma.module';
import { MerchantTypeController } from './merchant-type.controller';
import { MerchantTypeService } from './merchant-type.service';
import { MerchantTypeV2Controller } from '../v2/controllers/feature.v2-controllers';

@Module({
  imports: [PrismaModule],
  controllers: [MerchantTypeController, MerchantTypeV2Controller],
  providers: [MerchantTypeService, CloudinaryService],
  exports: [MerchantTypeService],
})
export class MerchantTypeModule {}
