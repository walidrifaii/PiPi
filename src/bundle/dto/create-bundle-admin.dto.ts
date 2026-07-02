import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';
import { CreateBundleMerchantDto } from './create-bundle-merchant.dto';

export class CreateBundleAdminDto extends CreateBundleMerchantDto {
  @ApiProperty({
    description: 'Store this bundle belongs to',
    format: 'uuid',
  })
  @IsUUID()
  merchantId!: string;
}
