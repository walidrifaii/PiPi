import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, IsOptional, Min } from 'class-validator';

export class QuoteDeliveryFeeQueryDto {
  @ApiPropertyOptional({
    example: 3.5,
    description:
      'Known distance in km. Alternatively pass fromLat, fromLng, toLat, toLng.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  distanceKm?: number;

  @ApiPropertyOptional({ example: 32.8872 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  fromLat?: number;

  @ApiPropertyOptional({ example: 13.1913 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  fromLng?: number;

  @ApiPropertyOptional({ example: 32.9 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  toLat?: number;

  @ApiPropertyOptional({ example: 13.2 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  toLng?: number;
}
