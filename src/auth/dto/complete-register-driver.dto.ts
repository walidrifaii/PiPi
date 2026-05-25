import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, Matches, MinLength } from 'class-validator';

/** Step 3: driver profile after phone OTP was verified. */
export class CompleteRegisterDriverDto {
  @ApiProperty({
    description: 'Phone in E.164 format (same as steps 1–2)',
    example: '+96170123456',
  })
  @IsString()
  @Matches(/^\+[1-9]\d{6,14}$/, {
    message: 'phone must be E.164 format (e.g. +96170123456)',
  })
  phone: string;

  @ApiProperty({ example: 'Karim Nasser' })
  @IsString()
  @MinLength(2)
  fullName: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({
    description: 'e.g. motorbike, car',
  })
  @IsOptional()
  @IsString()
  vehicleType?: string;
}
