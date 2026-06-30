import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { ORDER_STATUSES } from '../order-status.constants';

export class UpdateOrderStatusDto {
  @ApiProperty({
    enum: ORDER_STATUSES,
    example: 'ACCEPTED',
    description: 'New order status',
  })
  @IsString()
  @IsIn([...ORDER_STATUSES])
  status!: string;

  @ApiPropertyOptional({
    example: 15,
    description: 'Preparation time in minutes (set by merchant when accepting)',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  preparationTime?: number;
}
