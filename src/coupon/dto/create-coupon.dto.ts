import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateCouponDto {
  @ApiProperty({
    description:
      'Unique coupon code (letters, digits, hyphens, underscores). Stored uppercase.',
    example: 'SUMMER20',
    maxLength: 50,
  })
  @IsString()
  @MaxLength(50)
  @Matches(/^[A-Za-z0-9_-]+$/, {
    message: 'code must contain only letters, digits, hyphens, or underscores',
  })
  code: string;

  @ApiProperty({
    description: 'Name of the person or team who created this coupon.',
    example: 'Marketing Team',
    maxLength: 255,
  })
  @IsString()
  @MaxLength(255)
  authorName: string;

  @ApiProperty({
    description: 'Percentage discount applied to the order subtotal (1–100).',
    example: 15,
    minimum: 1,
    maximum: 100,
  })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(1)
  @Max(100)
  discountPercent: number;

  @ApiPropertyOptional({
    description: 'ISO 8601 datetime after which the coupon is no longer valid.',
    example: '2026-12-31T23:59:59Z',
  })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @ApiPropertyOptional({
    description:
      'Maximum total redemptions allowed across all users. Omit for unlimited.',
    example: 500,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maxUsages?: number;

  @ApiPropertyOptional({
    description: 'Whether the coupon is immediately active after creation.',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
