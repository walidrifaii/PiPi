import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { PICKUP_BLOCKED_APPLIES_TO } from '../pickup.constants';

export class CreatePickupBlockedZoneDto {
  @ApiProperty({ example: 'Airport restricted' })
  @IsString()
  @MaxLength(255)
  name!: string;

  @ApiProperty({
    enum: PICKUP_BLOCKED_APPLIES_TO,
    example: 'TO',
    description: 'FROM = cannot collect, TO = cannot drop off, BOTH = neither',
  })
  @IsIn([...PICKUP_BLOCKED_APPLIES_TO])
  appliesTo!: (typeof PICKUP_BLOCKED_APPLIES_TO)[number];

  @ApiProperty({
    description:
      'GeoJSON Polygon, Feature(Polygon), or FeatureCollection containing a Polygon',
  })
  @IsObject()
  boundaryGeoJson!: Record<string, unknown>;

  @ApiPropertyOptional({
    example: 'We cannot deliver to this location',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  reason?: string;

  @ApiPropertyOptional({ default: true })
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
}

export class UpdatePickupBlockedZoneDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional({ enum: PICKUP_BLOCKED_APPLIES_TO })
  @IsOptional()
  @IsIn([...PICKUP_BLOCKED_APPLIES_TO])
  appliesTo?: (typeof PICKUP_BLOCKED_APPLIES_TO)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  boundaryGeoJson?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  reason?: string | null;

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
}
