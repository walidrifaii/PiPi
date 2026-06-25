import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class SetMerchantEnabledDto {
  @ApiProperty({
    description:
      'Admin kill-switch: true = merchant is visible to customers; false = hidden from all public responses',
  })
  @IsBoolean()
  isEnabled: boolean;
}
