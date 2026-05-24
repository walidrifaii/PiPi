import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString } from 'class-validator';
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
}
