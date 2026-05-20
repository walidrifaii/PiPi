import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { CheckoutItemDto } from './checkout-item.dto';

export class CreateCheckoutDto {
  @ApiProperty({
    format: 'uuid',
    description: 'All line items must belong to this merchant',
  })
  @IsUUID()
  merchantId: string;

  @ApiProperty({
    description: 'Merchant display name (from client)',
    example: 'Pizza House',
  })
  @IsString()
  @MaxLength(255)
  merchantName: string;

  @ApiProperty({ description: 'Order subtotal (from client)' })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  subtotal: number;

  @ApiProperty({ description: 'Order total including delivery (from client)' })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  total: number;

  @ApiProperty({
    description: 'Delivery distance in km (from client)',
    example: 3.5,
  })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  distanceKm: number;

  @ApiProperty({
    description: 'Estimated delivery time in minutes (from client)',
    example: 35,
  })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  deliveryTimeMinutes: number;

  @ApiProperty({
    description: 'Delivery location latitude (from client)',
    example: 32.8872,
  })
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude: number;

  @ApiProperty({
    description: 'Delivery location longitude (from client)',
    example: 13.1913,
  })
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude: number;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Optional saved address id to link on the order',
  })
  @IsOptional()
  @IsUUID()
  addressId?: string;

  @ApiProperty({ type: [CheckoutItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CheckoutItemDto)
  items: CheckoutItemDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
