import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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

export class CreateMerchantOfferAdminDto {
  @ApiProperty({
    description: 'Store this promo is for (super admin picks the merchant)',
    format: 'uuid',
  })
  @IsUUID()
  merchantId!: string;

  @ApiPropertyOptional({ example: 'Summer sale' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @ApiProperty({
    description:
      'Badge label only (e.g. 10 = show "10% off"). Does NOT change product prices at checkout.',
    example: 10,
    minimum: 0.01,
    maximum: 99.99,
  })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(99.99)
  discountPercent!: number;

  @ApiProperty({
    description: 'When the promo closes (ISO 8601). After this it is hidden from customers.',
    example: '2026-06-30T23:59:59.000Z',
  })
  @IsDateString()
  endsAt!: string;

  @ApiPropertyOptional({
    description: 'Show to customers (default true). Display-only; checkout uses product prices.',
    default: true,
  })
  @IsOptional()
  @Transform(({ value }) => parseOptionalFormBoolean(value))
  @IsBoolean()
  isActive?: boolean;
}
