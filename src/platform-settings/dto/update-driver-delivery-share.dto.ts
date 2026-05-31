import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, Max, Min } from 'class-validator';

export class UpdateDriverDeliveryShareDto {
  @ApiProperty({
    example: 60,
    description:
      'Percent of the customer delivery fee paid to the driver (0–100)',
  })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  percent: number;
}
