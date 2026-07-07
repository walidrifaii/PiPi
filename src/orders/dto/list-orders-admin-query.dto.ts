import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import {
  ORDER_STATUSES,
  type OrderStatus,
} from '../order-status.constants';

function parseCsvQuery(value: unknown): string[] | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  if (Array.isArray(value)) {
    return value.map(String).filter(Boolean);
  }
  return String(value)
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

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
    description:
      'Filter by multiple statuses (comma-separated). Example: `PENDING,ACCEPTED`.',
    example: 'PENDING,ACCEPTED',
  })
  @IsOptional()
  @Transform(({ value }) => parseCsvQuery(value))
  @IsArray()
  @IsIn([...ORDER_STATUSES], { each: true })
  statusIn?: OrderStatus[];

  @ApiPropertyOptional({
    description: 'When true, only orders with no assigned driver (`driverId` is null).',
    example: true,
  })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  unassignedOnly?: boolean;

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
