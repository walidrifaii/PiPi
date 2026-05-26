import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { ValidateDiscountNotAbovePrice } from '../validators/discount-not-greater-than-price.constraint';

/** Form fields for `POST /merchants/me/products` (multipart text fields; binary upload field name `imageUrl`). */
export class CreateProductMerchantMultipartDto {
  @ApiProperty({ format: 'uuid', description: 'Category id (your store)' })
  @IsUUID()
  categoryId: string;

  @ApiProperty()
  @IsString()
  @MaxLength(255)
  name: string;

  @ApiProperty({ type: Number })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  price: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Arabic product name' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  nameAr?: string;

  @ApiPropertyOptional({ description: 'Arabic description' })
  @IsOptional()
  @IsString()
  descriptionAr?: string;

  @ApiPropertyOptional({ type: Number })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @ValidateDiscountNotAbovePrice()
  discountPrice?: number;

  @ApiPropertyOptional({
    description:
      'JSON array of option groups (same shape as CreateProductDto.optionGroups)',
    example:
      '[{"name":"Size","choices":[{"name":"Small","priceModifier":0},{"name":"Large","priceModifier":2}]}]',
  })
  @IsOptional()
  @IsString()
  optionGroupsJson?: string;
}
