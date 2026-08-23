import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { PICKUP_METHODS } from '../pickup.constants';

export class PickupLocationInputDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  addressId?: string;

  @ApiPropertyOptional({ example: 'Omar Al-Mukhtar Street' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  addressLine?: string;

  @ApiProperty({ example: 32.8872 })
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude!: number;

  @ApiProperty({ example: 13.1913 })
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude!: number;
}

export class CreatePickupDto {
  @ApiProperty({ enum: PICKUP_METHODS, example: 'NOW' })
  @IsIn([...PICKUP_METHODS])
  method!: (typeof PICKUP_METHODS)[number];

  @ApiProperty({ type: PickupLocationInputDto })
  @ValidateNested()
  @Type(() => PickupLocationInputDto)
  from!: PickupLocationInputDto;

  @ApiProperty({ type: PickupLocationInputDto })
  @ValidateNested()
  @Type(() => PickupLocationInputDto)
  to!: PickupLocationInputDto;

  @ApiProperty({
    example: 'Documents envelope',
    description: 'What the driver should collect and deliver',
  })
  @IsString()
  @MaxLength(2000)
  description!: string;

  @ApiProperty({ example: 50, description: 'Declared package value' })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  declaredValue!: number;

  @ApiProperty({
    description: 'Must match server quote for this route',
  })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  deliveryFee!: number;

  @ApiProperty({
    description: 'Must match active pickup service fee',
  })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  serviceFee!: number;

  @ApiProperty({ example: 4.2 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  distanceKm!: number;

  @ApiProperty({
    example: 'Ahmad Hassan',
    description: 'Full name of the person who will receive the package',
  })
  @IsString()
  @MinLength(2)
  @MaxLength(191)
  recipientFullName!: string;

  @ApiProperty({
    example: '+218912345678',
    description: 'Phone of the person who will receive the package (E.164)',
  })
  @IsString()
  @Matches(/^\+[1-9]\d{6,14}$/, {
    message: 'recipientPhone must be E.164 format (e.g. +218912345678)',
  })
  recipientPhone!: string;

  @ApiPropertyOptional({
    example: '2026-08-17T10:00:00.000Z',
    description: 'Required when method is SCHEDULED',
  })
  @IsOptional()
  @IsString()
  scheduledAt?: string;
}
