import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, Matches, MinLength } from 'class-validator';

export class RegisterUserDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  fullName?: string;

  @ApiProperty({
    description: 'Phone in E.164 format (OTP sent via WhatsApp)',
    example: '+96170123456',
  })
  @IsString()
  @Matches(/^\+[1-9]\d{6,14}$/, {
    message: 'phone must be E.164 format (e.g. +96170123456)',
  })
  phone: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  password: string;
}
