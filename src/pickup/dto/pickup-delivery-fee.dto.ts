import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreatePickupDeliveryFeeConfigDto {
  @ApiPropertyOptional({ example: 'Pickup default' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiProperty({ example: 100, description: 'Minimum delivery fee' })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  fixedFee!: number;

  @ApiProperty({ example: 10 })
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  includedKm!: number;

  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  kmUnit!: number;

  @ApiProperty({ example: 20 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  feePerUnit!: number;

  @ApiProperty({ example: 500, description: 'Maximum delivery fee' })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxFee!: number;

  @ApiProperty({ example: 30 })
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  maxKm!: number;

  @ApiPropertyOptional({ example: 5 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  previewDistanceKm?: number;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class UpdatePickupDeliveryFeeConfigDto extends PartialType(
  CreatePickupDeliveryFeeConfigDto,
) {}
