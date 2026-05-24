import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length, Matches } from 'class-validator';
import { OptionalFcmTokenDto } from './optional-fcm-token.dto';

export class VerifyLoginOtpDto extends OptionalFcmTokenDto {
  @ApiProperty({
    description: 'Phone in E.164 format (same as send-otp)',
    example: '+96170123456',
  })
  @IsString()
  @Matches(/^\+[1-9]\d{6,14}$/, {
    message: 'phone must be E.164 format (e.g. +96170123456)',
  })
  phone: string;

  @ApiProperty({
    description: '6-digit OTP received on WhatsApp',
    example: '123456',
  })
  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/, { message: 'code must be exactly 6 digits' })
  code: string;
}
