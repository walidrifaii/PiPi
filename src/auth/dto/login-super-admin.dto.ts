import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';
import { OptionalFcmTokenDto } from './optional-fcm-token.dto';

export class LoginSuperAdminDto extends OptionalFcmTokenDto {
  @ApiProperty({ description: 'Email or phone number' })
  @IsString()
  identifier: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  password: string;
}
