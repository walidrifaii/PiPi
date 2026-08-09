import { ApiPropertyOptional, OmitType } from '@nestjs/swagger';
import { IsArray, IsOptional, IsUUID } from 'class-validator';
import { CheckoutItemDto } from '../../../checkout/dto/checkout-item.dto';

/**
 * V3 checkout line item. Each array entry is one configuration (product + options).
 * Same product with different options must be separate items — do not merge into one quantity.
 */
export class CheckoutItemV3Dto extends OmitType(CheckoutItemDto, [
  'selectedChoiceIds',
] as const) {
  @ApiPropertyOptional({
    type: [String],
    format: 'uuid',
    description:
      'Option choice ids for this line only. To order the same product with different options (e.g. 2× Large + 1× Small), send multiple checkout items with the same productId and different selectedChoiceIds — not one item with quantity 3.',
    example: ['aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'],
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  selectedChoiceIds?: string[];
}
