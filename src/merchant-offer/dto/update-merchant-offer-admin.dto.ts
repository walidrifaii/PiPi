import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { parseOptionalFormBoolean } from '../../banner/dto/banner-form-boolean.transform';

export class UpdateMerchantOfferAdminDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  merchantId?: string;

  @ApiPropertyOptional({ example: 'Weekend deal' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @ApiPropertyOptional({ example: 'عرض نهاية الأسبوع' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  titleAr?: string;

  @ApiPropertyOptional({
    description: 'Badge label only; does not change checkout prices',
    example: 15,
    minimum: 0.01,
    maximum: 99.99,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(99.99)
  discountPercent?: number;

  @ApiPropertyOptional({
    description: 'When false, hidden from customer offer list',
  })
  @IsOptional()
  @Transform(({ value }) => parseOptionalFormBoolean(value))
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'New start date-time (ISO 8601)',
    example: '2026-06-01T00:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @ApiPropertyOptional({
    description: 'New close date-time (ISO 8601)',
    example: '2026-07-15T23:59:59.000Z',
  })
  @IsOptional()
  @IsDateString()
  endsAt?: string;
}
