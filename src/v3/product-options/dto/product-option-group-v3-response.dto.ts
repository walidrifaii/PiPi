import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ProductOptionChoiceV3ResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Large' })
  name!: string;

  @ApiPropertyOptional({ example: 'كبير' })
  nameAr!: string | null;

  @ApiProperty({
    description: 'Added to base effective price when this choice is selected.',
    example: 2,
  })
  priceModifier!: number;

  @ApiProperty({ example: 0 })
  sortOrder!: number;

  @ApiProperty({ example: true })
  isActive!: boolean;
}

export class ProductOptionGroupV3ResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Size' })
  name!: string;

  @ApiPropertyOptional({ example: 'الحجم' })
  nameAr!: string | null;

  @ApiProperty({ example: true })
  isRequired!: boolean;

  @ApiProperty({ example: 1 })
  minSelect!: number;

  @ApiProperty({ example: 1 })
  maxSelect!: number;

  @ApiProperty({ example: 0 })
  sortOrder!: number;

  @ApiProperty({ type: [ProductOptionChoiceV3ResponseDto] })
  choices!: ProductOptionChoiceV3ResponseDto[];
}

export class ProductOptionsProductV3ResponseDto {
  @ApiProperty({ format: 'uuid' })
  productId!: string;

  @ApiProperty({ example: 'Mixed Nuts' })
  name!: string;

  @ApiPropertyOptional({ example: 'مكسرات مشكلة' })
  nameAr!: string | null;

  @ApiProperty({ example: 10 })
  price!: number;

  @ApiPropertyOptional({ example: 9 })
  discountPrice!: number | null;

  @ApiProperty({ example: 9 })
  effectivePrice!: number;

  @ApiProperty({
    description: 'True when the product has configurable size/extras options.',
    example: true,
  })
  hasOptions!: boolean;

  @ApiPropertyOptional({
    type: [ProductOptionGroupV3ResponseDto],
    description: 'Included only when hasOptions is true.',
  })
  optionGroups?: ProductOptionGroupV3ResponseDto[];
}
