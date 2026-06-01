import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateDeliveryFeeConfigDto {
  @ApiPropertyOptional({ example: 'Tripoli' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiProperty({
    example: 1.5,
    description:
      'Minimum delivery fee. Charged alone when distance ≤ includedKm (no extra per km).',
  })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  fixedFee!: number;

  @ApiProperty({
    example: 10,
    description:
      'Km radius included in fixedFee only (e.g. 1.5 for up to 10 km — no extra charge inside).',
  })
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  includedKm!: number;

  @ApiProperty({
    example: 1,
    description: 'After includedKm, charge every N extra km (1 = each km).',
  })
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  kmUnit!: number;

  @ApiProperty({
    example: 1,
    description: 'Price per km step beyond includedKm.',
  })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  feePerUnit!: number;

  @ApiProperty({
    example: 8,
    description:
      'Maximum delivery fee (price cap). Never charge more than this amount.',
  })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxFee!: number;

  @ApiProperty({
    example: 30,
    description:
      'Maximum km for billing. Trips longer than this pay the same as maxKm (no extra charge after).',
  })
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  maxKm!: number;

  @ApiPropertyOptional({
    example: 15,
    description: 'Preview distance for sampleBreakdown saved in DB',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  previewDistanceKm?: number;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
