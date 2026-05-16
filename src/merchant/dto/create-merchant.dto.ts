import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateMerchantDto {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty({
    format: 'uuid',
    description: 'Merchant type id (see GET /merchant-types)',
  })
  @IsUUID('4')
  merchantTypeId: string;

  @ApiPropertyOptional({ description: 'Logo image URL' })
  @IsOptional()
  @IsString()
  logoUrl?: string;

  @ApiPropertyOptional({ description: 'Cover / banner image URL' })
  @IsOptional()
  @IsString()
  coverImageUrl?: string;

  @ApiPropertyOptional({
    description: 'Required if password is set (merchant portal login)',
  })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ description: 'Required if password is set' })
  @IsOptional()
  @IsString()
  @MinLength(5)
  @MaxLength(50)
  phone?: string;

  @ApiPropertyOptional({
    minLength: 8,
    description: 'If set, email and phone are required',
  })
  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => {
    if (value === true || value === false) {
      return value;
    }
    if (typeof value === 'string') {
      if (value.toLowerCase() === 'true') {
        return true;
      }
      if (value.toLowerCase() === 'false') {
        return false;
      }
    }
    return value;
  })
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    example: 'TRIPOLI',
    description: 'Service area code for catalog filtering (stored uppercase)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  cityCode?: string;

  @ApiPropertyOptional({ description: 'Store latitude (WGS84), for near-me' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @ApiPropertyOptional({ description: 'Store longitude (WGS84), for near-me' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;
}
