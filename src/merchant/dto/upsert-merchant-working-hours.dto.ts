import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class WorkingHoursIntervalDto {
  @ApiProperty({ example: '09:00', description: '24h local time in merchant timezone' })
  @Matches(/^([01]?\d|2[0-3]):[0-5]\d$/)
  open: string;

  @ApiProperty({ example: '22:00' })
  @Matches(/^([01]?\d|2[0-3]):[0-5]\d$/)
  close: string;
}

export class WorkingHoursDayDto {
  @ApiProperty({ minimum: 1, maximum: 7, description: 'ISO weekday: 1=Mon … 7=Sun' })
  @IsInt()
  @Min(1)
  @Max(7)
  weekday: number;

  @ApiProperty({ type: [WorkingHoursIntervalDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WorkingHoursIntervalDto)
  intervals: WorkingHoursIntervalDto[];
}

export class UpsertMerchantWorkingHoursDto {
  @ApiProperty({
    description:
      'When true, customers only see the store as open during the weekly schedule (and manual OPEN).',
  })
  @IsBoolean()
  useWorkingHours: boolean;

  @ApiPropertyOptional({
    example: 'Africa/Tripoli',
    description: 'Required when useWorkingHours is true',
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  timezone?: string;

  @ApiPropertyOptional({
    type: [WorkingHoursDayDto],
    description: 'Required when useWorkingHours is true',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WorkingHoursDayDto)
  days?: WorkingHoursDayDto[];
}
