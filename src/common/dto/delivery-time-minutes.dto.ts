import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, Min, Validate } from 'class-validator';
import { MaxGteMinDeliveryTimeConstraint } from '../validators/max-gte-min-delivery-time.constraint';

export class DeliveryTimeMinutesDto {
  @ApiProperty({
    description: 'Minimum estimated delivery time in minutes',
    example: 10,
  })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  min: number;

  @ApiProperty({
    description: 'Maximum estimated delivery time in minutes',
    example: 40,
  })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Validate(MaxGteMinDeliveryTimeConstraint)
  max: number;
}
