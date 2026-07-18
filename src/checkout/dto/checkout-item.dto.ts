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
  ValidateIf,
} from 'class-validator';

export class CheckoutItemDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Product line item (omit when bundleId is set)',
  })
  @ValidateIf((o: CheckoutItemDto) => !o.bundleId)
  @IsUUID()
  productId?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Bundle line item (omit when productId is set)',
  })
  @ValidateIf((o: CheckoutItemDto) => !o.productId)
  @IsUUID()
  bundleId?: string;

  @ApiProperty({ description: 'Line item name shown on the order (from client)' })
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

  /** @deprecated Ignored. Per-product discountPrice was removed. */
  @ApiPropertyOptional({
    deprecated: true,
    description: 'Ignored — per-product discount price was removed',
  })
  @IsOptional()
  discountPrice?: unknown;

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
