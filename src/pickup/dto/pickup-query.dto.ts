import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  Max,
  Min,
} from 'class-validator';
import { PICKUP_LOCATION_ROLES } from '../pickup.constants';

export class PickupCoverageQueryDto {
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng!: number;

  @ApiPropertyOptional({ enum: PICKUP_LOCATION_ROLES, example: 'to' })
  @IsOptional()
  @IsIn([...PICKUP_LOCATION_ROLES])
  role?: (typeof PICKUP_LOCATION_ROLES)[number];
}

export class QuotePickupQueryDto {
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  fromLat!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  fromLng!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  toLat!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  toLng!: number;
}

export class ListPickupSlotsQueryDto {
  @ApiPropertyOptional({
    example: '2026-08-16',
    description: 'Start date YYYY-MM-DD in pickup timezone. Default: today.',
  })
  @IsOptional()
  from?: string;

  @ApiPropertyOptional({ default: 14, minimum: 1, maximum: 31 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(31)
  days?: number;
}
