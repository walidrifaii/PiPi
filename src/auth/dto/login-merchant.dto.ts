import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';
import { OptionalFcmTokenDto } from './optional-fcm-token.dto';

export class LoginMerchantDto extends OptionalFcmTokenDto {
  @ApiProperty({ description: 'Account email or phone number' })
  @IsString()
  identifier: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  password: string;
}
