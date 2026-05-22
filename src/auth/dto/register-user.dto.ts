import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';

/** Step 1: submit phone only; OTP is sent via WhatsApp. */
export class RegisterUserDto {
  @ApiProperty({
    description: 'Phone in E.164 format (OTP sent via WhatsApp)',
    example: '+96170123456',
  })
  @IsString()
  @Matches(/^\+[1-9]\d{6,14}$/, {
    message: 'phone must be E.164 format (e.g. +96170123456)',
  })
  phone: string;
}
