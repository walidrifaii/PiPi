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
import { SPECIAL_REQUEST_STATUSES } from '../special-request.constants';

export const ADMIN_SPECIAL_REQUEST_STATUS_FILTERS = [
  'LIVE',
  ...SPECIAL_REQUEST_STATUSES,
] as const;

export class ListSpecialRequestsAdminQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  requestId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  storeName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  itemName?: string;

  @ApiPropertyOptional({
    description: 'Matches customer full name',
  })
  @IsOptional()
  @IsString()
  userName?: string;

  @ApiPropertyOptional({
    description: 'Matches customer phone',
  })
  @IsOptional()
  @IsString()
  number?: string;

  @ApiPropertyOptional({ enum: ADMIN_SPECIAL_REQUEST_STATUS_FILTERS })
  @IsOptional()
  @IsIn([...ADMIN_SPECIAL_REQUEST_STATUS_FILTERS])
  status?: (typeof ADMIN_SPECIAL_REQUEST_STATUS_FILTERS)[number];

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

export class UpdateSpecialRequestStatusDto {
  @ApiProperty({ enum: SPECIAL_REQUEST_STATUSES })
  @IsIn([...SPECIAL_REQUEST_STATUSES])
  status!: (typeof SPECIAL_REQUEST_STATUSES)[number];
}

export class AssignSpecialRequestDriverDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  driverId!: string;
}
