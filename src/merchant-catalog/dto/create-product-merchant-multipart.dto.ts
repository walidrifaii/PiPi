import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

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

  /** @deprecated Ignored. Per-product discountPrice was removed; use merchant offers. */
  @ApiPropertyOptional({
    deprecated: true,
    description: 'Ignored — per-product discount price was removed',
  })
  @IsOptional()
  discountPrice?: unknown;

  @ApiPropertyOptional({
    description: 'When false, product is hidden from v2 customer storefront.',
    default: true,
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return value;
  })
  @IsBoolean()
  isActive?: boolean;

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
