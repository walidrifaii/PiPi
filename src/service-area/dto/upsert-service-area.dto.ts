import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';

/** Super admin: create/update a service area boundary (GeoJSON Polygon). */
export class UpsertServiceAreaDto {
  @ApiPropertyOptional({ description: 'Display name' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional({
    nullable: true,
    description:
      'GeoJSON Polygon geometry, or Feature / FeatureCollection containing a Polygon. Send null to clear the boundary.',
  })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsObject()
  boundaryGeoJson?: Record<string, unknown> | null;

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
