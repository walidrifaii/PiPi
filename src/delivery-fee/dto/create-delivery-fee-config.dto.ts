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
    description: 'Fixed base delivery price (always added)',
  })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  fixedFee!: number;

  @ApiProperty({
    example: 1,
    description:
      'Distance step in km (1 = charge every 1 km, 2 = every 2 km, 5 = every 5 km). Admin can change this.',
  })
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  kmUnit!: number;

  @ApiProperty({
    example: 1,
    description:
      'Price charged for each km step (e.g. kmUnit=2 and feePerUnit=1 → $1 per 2 km)',
  })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  feePerUnit!: number;

  @ApiPropertyOptional({
    example: 5,
    description:
      'Distance (km) used to build and save sampleBreakdown in DB when creating',
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
