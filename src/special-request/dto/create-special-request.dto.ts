import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsNumber,
  IsString,
  IsUrl,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { PickupLocationInputDto } from '../../pickup/dto/create-pickup.dto';

export class CreateSpecialRequestDto {
  @ApiProperty({ example: 'Al-Waha Pharmacy' })
  @IsString()
  @MinLength(2)
  @MaxLength(191)
  storeName!: string;

  @ApiProperty({ example: 'Panadol extra' })
  @IsString()
  @MinLength(2)
  @MaxLength(191)
  itemName!: string;

  @ApiProperty({
    example: 'https://cdn.example.com/athar/special-requests/item.jpg',
    description: 'URL returned by POST /special-requests/upload-image',
  })
  @IsUrl({ require_tld: false })
  @MaxLength(500)
  productImageUrl!: string;

  @ApiProperty({
    type: PickupLocationInputDto,
    description: 'Store / item location',
  })
  @ValidateNested()
  @Type(() => PickupLocationInputDto)
  from!: PickupLocationInputDto;

  @ApiProperty({
    type: PickupLocationInputDto,
    description: 'Customer delivery address',
  })
  @ValidateNested()
  @Type(() => PickupLocationInputDto)
  to!: PickupLocationInputDto;

  @ApiProperty({
    description: 'Must match the super-admin fixed buy/service fee',
  })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  serviceFee!: number;
}
