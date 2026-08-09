import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SelectedOptionSnapshotV3Dto {
  @ApiProperty({ format: 'uuid' })
  groupId!: string;

  @ApiProperty({ example: 'Size' })
  groupName!: string;

  @ApiProperty({ format: 'uuid' })
  choiceId!: string;

  @ApiProperty({ example: 'Large' })
  choiceName!: string;

  @ApiProperty({ example: 2 })
  priceModifier!: number;
}

export class ProductOptionQuoteLineResultV3Dto {
  @ApiProperty({ format: 'uuid' })
  productId!: string;

  @ApiProperty({ example: 'Mixed Nuts' })
  productName!: string;

  @ApiProperty({ example: 'Mixed Nuts (Large, Extra Kaju)' })
  displayName!: string;

  @ApiProperty({ example: 1 })
  quantity!: number;

  @ApiProperty({ example: 10 })
  listPrice!: number;

  @ApiPropertyOptional({ example: 9 })
  discountPrice!: number | null;

  @ApiProperty({
    description: 'Final unit price after store discount and option modifiers.',
    example: 15,
  })
  unitPrice!: number;

  @ApiProperty({ example: 15 })
  totalPrice!: number;

  @ApiProperty({ type: [SelectedOptionSnapshotV3Dto] })
  selectedOptions!: SelectedOptionSnapshotV3Dto[];
}

export class QuoteProductOptionsV3ResponseDto {
  @ApiProperty({ format: 'uuid' })
  merchantId!: string;

  @ApiProperty({ type: [ProductOptionQuoteLineResultV3Dto] })
  lines!: ProductOptionQuoteLineResultV3Dto[];

  @ApiProperty({
    description: 'Sum of all line totalPrice values.',
    example: 38,
  })
  subtotal!: number;
}
