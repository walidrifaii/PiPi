import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, Min, Validate } from 'class-validator';
import { MaxGteMinMinutesConstraint } from '../validators/max-gte-min-minutes.constraint';

export class UpsertMerchantDeliveryTimeDto {
  @ApiProperty({
    description: 'Minimum estimated delivery time in minutes',
    example: 25,
  })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minMinutes: number;

  @ApiProperty({
    description: 'Maximum estimated delivery time in minutes',
    example: 45,
  })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Validate(MaxGteMinMinutesConstraint)
  maxMinutes: number;
}
