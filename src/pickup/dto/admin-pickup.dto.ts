import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { PICKUP_METHODS, PICKUP_STATUSES } from '../pickup.constants';

export const ADMIN_PICKUP_STATUS_FILTERS = [
  'LIVE',
  ...PICKUP_STATUSES,
] as const;

export class ListPickupsAdminQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  pickupId?: string;

  @ApiPropertyOptional({
    description: 'Matches customer or recipient full name',
  })
  @IsOptional()
  @IsString()
  userName?: string;

  @ApiPropertyOptional({
    description: 'Matches customer or recipient phone',
  })
  @IsOptional()
  @IsString()
  number?: string;

  @ApiPropertyOptional({ enum: ADMIN_PICKUP_STATUS_FILTERS })
  @IsOptional()
  @IsIn([...ADMIN_PICKUP_STATUS_FILTERS])
  status?: (typeof ADMIN_PICKUP_STATUS_FILTERS)[number];

  @ApiPropertyOptional({ enum: PICKUP_METHODS })
  @IsOptional()
  @IsIn([...PICKUP_METHODS])
  method?: (typeof PICKUP_METHODS)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  from?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  to?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class UpdatePickupStatusDto {
  @ApiProperty({ enum: PICKUP_STATUSES })
  @IsIn([...PICKUP_STATUSES])
  status!: (typeof PICKUP_STATUSES)[number];
}

export class AssignPickupDriverDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  driverId!: string;
}
