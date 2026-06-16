import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';

/** Query values for `GET /merchants/me/orders/history` status filter. */
export const MERCHANT_ORDER_HISTORY_STATUS_FILTERS = [
  'Delivered',
  'Cancelled',
] as const;

export type MerchantOrderHistoryStatusFilter =
  (typeof MERCHANT_ORDER_HISTORY_STATUS_FILTERS)[number];

export class ListMerchantOrdersHistoryQueryDto {
  @ApiPropertyOptional({
    description:
      'Filter by terminal status. Omit to return both Delivered and Cancelled.',
    enum: MERCHANT_ORDER_HISTORY_STATUS_FILTERS,
    example: 'Delivered',
  })
  @IsOptional()
  @IsIn([...MERCHANT_ORDER_HISTORY_STATUS_FILTERS])
  status?: MerchantOrderHistoryStatusFilter;

  @ApiPropertyOptional({
    description:
      'Search by order id (full UUID, short display id, or checkout ref) or customer name (partial, case-insensitive). Minimum 2 characters.',
    example: '347a5c58',
  })
  @IsOptional()
  @IsString()
  @MinLength(2)
  search?: string;

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
