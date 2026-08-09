import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

export class ProductOptionQuoteLineV3Dto {
  @ApiProperty({
    format: 'uuid',
    description: 'Catalog product id.',
  })
  @IsUUID()
  productId!: string;

  @ApiProperty({
    minimum: 1,
    example: 1,
    description:
      'Quantity for this exact option configuration. Use separate lines when the same product has different options (e.g. 2× Large and 1× Small).',
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity!: number;

  @ApiPropertyOptional({
    type: [String],
    format: 'uuid',
    description:
      'Selected option choice ids for this line. Omit or send [] when the product has no options.',
    example: ['aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'],
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  selectedChoiceIds?: string[];
}

export class QuoteProductOptionsV3Dto {
  @ApiProperty({
    format: 'uuid',
    description: 'All lines must belong to this merchant.',
  })
  @IsUUID()
  merchantId!: string;

  @ApiProperty({
    type: [ProductOptionQuoteLineV3Dto],
    description:
      'One entry per unique product + options combination. Duplicate productId is allowed when selectedChoiceIds differ.',
    example: [
      {
        productId: '11111111-1111-1111-1111-111111111111',
        quantity: 2,
        selectedChoiceIds: ['22222222-2222-2222-2222-222222222222'],
      },
      {
        productId: '11111111-1111-1111-1111-111111111111',
        quantity: 1,
        selectedChoiceIds: ['33333333-3333-3333-3333-333333333333'],
      },
    ],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ProductOptionQuoteLineV3Dto)
  lines!: ProductOptionQuoteLineV3Dto[];
}
