import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsString, Matches, MinLength } from 'class-validator';
import { OptionalFcmTokenDto } from './optional-fcm-token.dto';

/** Step 3: profile details after phone OTP was verified. */
export class CompleteRegisterUserDto extends OptionalFcmTokenDto {
  @ApiProperty({
    description: 'Phone in E.164 format (same as steps 1–2)',
    example: '+96170123456',
  })
  @IsString()
  @Matches(/^\+[1-9]\d{6,14}$/, {
    message: 'phone must be E.164 format (e.g. +96170123456)',
  })
  phone: string;

  @ApiProperty({ example: 'Ahmad Hassan' })
  @IsString()
  @MinLength(2)
  fullName: string;

  @ApiProperty({
    description: 'Date of birth (YYYY-MM-DD)',
    example: '1990-05-15',
  })
  @IsDateString()
  dateOfBirth: string;
}
