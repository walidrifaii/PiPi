import { ApiProperty, ApiPropertyOptional, OmitType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsNumber,
  IsOptional,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { CreateCheckoutDto } from '../../../checkout/dto/create-checkout.dto';
import { CheckoutItemV3Dto } from '../../product-options/dto/checkout-item-v3.dto';

export class CreateCheckoutV3Dto extends OmitType(CreateCheckoutDto, [
  'addressId',
  'latitude',
  'longitude',
  'items',
] as const) {
  @ApiProperty({
    format: 'uuid',
    description:
      'Required saved address id (from POST /v3/users/me/addresses).',
  })
  @IsUUID()
  addressId!: string;

  @ApiPropertyOptional({
    description:
      'Optional delivery latitude. When omitted, server uses the saved address coordinates.',
    example: 32.8872,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @ApiPropertyOptional({
    description:
      'Optional delivery longitude. When omitted, server uses the saved address coordinates.',
    example: 13.1913,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;

  @ApiProperty({
    type: [CheckoutItemV3Dto],
    description:
      'Order lines. Use one item per product + options combination. Same product with different sizes/extras must be separate items (each with its own selectedChoiceIds and quantity), not one item with mixed options.',
    example: [
      {
        productId: '11111111-1111-1111-1111-111111111111',
        productName: 'Mixed Nuts',
        quantity: 2,
        price: 10,
        selectedChoiceIds: ['22222222-2222-2222-2222-222222222222'],
      },
      {
        productId: '11111111-1111-1111-1111-111111111111',
        productName: 'Mixed Nuts',
        quantity: 1,
        price: 10,
        selectedChoiceIds: ['33333333-3333-3333-3333-333333333333'],
      },
    ],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CheckoutItemV3Dto)
  items!: CheckoutItemV3Dto[];
}
