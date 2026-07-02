import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';
import { UpdateBundleMerchantDto } from './update-bundle-merchant.dto';

export class UpdateBundleAdminDto extends UpdateBundleMerchantDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  merchantId?: string;
}
