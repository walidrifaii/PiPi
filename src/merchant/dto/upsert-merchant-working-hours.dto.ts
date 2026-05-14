import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
  Validate,
  ValidateNested,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import {
  MERCHANT_TIMEZONE_LEBANON,
  parseIsoWeekdayFromInput,
  parseLocalTimeToMinutes,
} from '../../common/merchant-open-status';

@ValidatorConstraint({ name: 'isWeekdayInput', async: false })
class IsWeekdayInputConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return parseIsoWeekdayFromInput(value) !== null;
  }

  defaultMessage(): string {
    return 'weekday must be an English day name (Monday, Mon, …) or ISO number 1–7';
  }
}

@ValidatorConstraint({ name: 'isMerchantLocalTime', async: false })
class IsMerchantLocalTimeConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return typeof value === 'string' && parseLocalTimeToMinutes(value.trim()) !== null;
  }

  defaultMessage(): string {
    return 'must be 24h HH:mm (or H:mm) or 12h h:mm AM/PM, in the merchant local timezone';
  }
}

export class WorkingHoursIntervalDto {
  @ApiProperty({
    example: '9:00 AM',
    description:
      'Local time in merchant timezone: 24h `HH:mm` / `H:mm`, or 12h `h:mm AM` / `h:mm PM` (case-insensitive).',
  })
  @IsString()
  @MaxLength(32)
  @Validate(IsMerchantLocalTimeConstraint)
  open: string;

  @ApiProperty({ example: '10:00 PM' })
  @IsString()
  @MaxLength(32)
  @Validate(IsMerchantLocalTimeConstraint)
  close: string;
}

export class WorkingHoursDayDto {
  @ApiProperty({
    example: 'Monday',
    description:
      'English day name or abbreviation (case-insensitive), e.g. Monday, Mon. Legacy: integers 1–7 or strings "1"–"7" are also accepted.',
  })
  @Transform(({ value }) => {
    if (value === null || value === undefined) {
      return value;
    }
    if (typeof value === 'number' && Number.isInteger(value)) {
      return String(value);
    }
    return String(value).trim();
  })
  @IsString()
  @Validate(IsWeekdayInputConstraint)
  weekday: string;

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
    example: MERCHANT_TIMEZONE_LEBANON,
    description:
      'Required when useWorkingHours is true. IANA name, e.g. Asia/Beirut for Lebanon.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  timezone?: string;

  @ApiPropertyOptional({
    type: [WorkingHoursDayDto],
    description:
      'Required when useWorkingHours is true. Each entry uses `weekday` as an English day name (e.g. Monday, Mon). Use `intervals: []` for a closed day, or omit that weekday (treated as closed). Multiple intervals per day are allowed (e.g. split shifts). Only open intervals are stored in the database for best performance.',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WorkingHoursDayDto)
  days?: WorkingHoursDayDto[];
}
