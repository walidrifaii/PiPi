import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { MerchantGeoQueryService } from './merchant-geo-query.service';

@Module({
  imports: [PrismaModule],
  providers: [MerchantGeoQueryService],
  exports: [MerchantGeoQueryService],
})
export class GeoModule {}
