import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, IsOptional, Max, Min } from 'class-validator';

export class UpdatePlatformEarningsDto {
  @ApiPropertyOptional({
    example: 60,
    description: 'Percent of delivery fee paid to the driver (0–100)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  driverDeliverySharePercent?: number;

  @ApiPropertyOptional({
    example: 100,
    description: 'Percent of food subtotal paid to the merchant (0–100)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  merchantFoodSharePercent?: number;
}
