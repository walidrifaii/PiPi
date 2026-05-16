import { Module } from '@nestjs/common';
import { CloudinaryService } from '../common/cloudinary.service';
import { PrismaModule } from '../prisma/prisma.module';
import { MerchantTypeController } from './merchant-type.controller';
import { MerchantTypeService } from './merchant-type.service';

@Module({
  imports: [PrismaModule],
  controllers: [MerchantTypeController],
  providers: [MerchantTypeService, CloudinaryService],
  exports: [MerchantTypeService],
})
export class MerchantTypeModule {}
