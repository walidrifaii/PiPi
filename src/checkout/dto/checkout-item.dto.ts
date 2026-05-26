import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  Validate,
} from 'class-validator';
import { DiscountNotGreaterThanPriceConstraint } from '../../merchant-catalog/validators/discount-not-greater-than-price.constraint';

export class CheckoutItemDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  productId: string;

  @ApiProperty({ description: 'Product name shown on the order (from client)' })
  @IsString()
  @MaxLength(255)
  productName: string;

  @ApiProperty({ minimum: 1, default: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity: number;

  @ApiProperty({ description: 'List unit price (from client)' })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  price: number;

  @ApiPropertyOptional({ description: 'Discounted unit price when on sale' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Validate(DiscountNotGreaterThanPriceConstraint)
  discountPrice?: number;

  @ApiPropertyOptional({
    description: 'Optional note for this line (e.g. no onions)',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  message?: string;

  @ApiPropertyOptional({
    description:
      'Selected option choice UUIDs (e.g. Large size). Server validates and adds price modifiers.',
    type: [String],
    format: 'uuid',
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  selectedChoiceIds?: string[];
}
