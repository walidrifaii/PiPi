import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export const ADMIN_MERCHANT_EARNINGS_PAYOUT_FILTERS = [
  'ALL',
  'UNPAID',
  'PAID',
  'NO_ORDERS',
] as const;

export type AdminMerchantEarningsPayoutFilter =
  (typeof ADMIN_MERCHANT_EARNINGS_PAYOUT_FILTERS)[number];

export class ListAdminAllMerchantEarningsQueryDto {
  @ApiPropertyOptional({
    description:
      'Search merchants by name, Arabic name, phone, or email (partial, case-insensitive where applicable).',
    example: 'Pizza',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    example: '2026-05-01T00:00:00.000Z',
    description: 'Earnings period start (ISO). Defaults to start of current month.',
  })
  @IsOptional()
  @IsISO8601()
  from?: string;

  @ApiPropertyOptional({
    example: '2026-05-31T23:59:59.999Z',
    description: 'Earnings period end (ISO). Defaults to now.',
  })
  @IsOptional()
  @IsISO8601()
  to?: string;

  @ApiPropertyOptional({
    example: true,
    description:
      'When true, uses the last 15 days as the earnings period (overrides from/to).',
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true || value === 1 || value === '1') {
      return true;
    }
    if (value === 'false' || value === false || value === 0 || value === '0') {
      return false;
    }
    return value;
  })
  @IsBoolean()
  last15Days?: boolean;

  @ApiPropertyOptional({
    enum: ADMIN_MERCHANT_EARNINGS_PAYOUT_FILTERS,
    default: 'ALL',
    description:
      'Filter merchants by payout state in the selected period. UNPAID = has unpaid merchant earnings; PAID = all delivered orders in period are settled; NO_ORDERS = no delivered orders in period.',
  })
  @IsOptional()
  @IsIn([...ADMIN_MERCHANT_EARNINGS_PAYOUT_FILTERS])
  payoutStatus?: AdminMerchantEarningsPayoutFilter;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
