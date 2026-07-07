import { ApiPropertyOptional } from '@nestjs/swagger';
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
import { ORDER_STATUSES } from '../order-status.constants';

/** Query values for `GET /admin/orders` status filter. `LIVE` = not delivered or cancelled. */
export const ADMIN_ORDER_STATUS_FILTERS = ['LIVE', ...ORDER_STATUSES] as const;

export type AdminOrderStatusFilter =
  (typeof ADMIN_ORDER_STATUS_FILTERS)[number];

export class ListOrdersAdminQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by store (merchant) id',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  merchantId?: string;

  @ApiPropertyOptional({
    description: 'Filter by order id',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  orderId?: string;

  @ApiPropertyOptional({
    description: 'Filter by customer name (partial match, case-insensitive)',
    example: 'Ahmad',
  })
  @IsOptional()
  @IsString()
  userName?: string;

  @ApiPropertyOptional({
    description: 'Filter by customer phone number (partial match)',
    example: '70123456',
  })
  @IsOptional()
  @IsString()
  number?: string;

  @ApiPropertyOptional({
    description:
      'Filter by order status. Use `LIVE` for all non-terminal orders.',
    enum: ADMIN_ORDER_STATUS_FILTERS,
    example: 'LIVE',
  })
  @IsOptional()
  @IsIn([...ADMIN_ORDER_STATUS_FILTERS])
  status?: AdminOrderStatusFilter;

  @ApiPropertyOptional({
    example: '2026-05-01T00:00:00.000Z',
    description: 'Include orders created on or after this time (ISO).',
  })
  @IsOptional()
  @IsISO8601()
  from?: string;

  @ApiPropertyOptional({
    example: '2026-05-31T23:59:59.999Z',
    description: 'Include orders created on or before this time (ISO).',
  })
  @IsOptional()
  @IsISO8601()
  to?: string;

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
