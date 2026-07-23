import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class UpdateAdminOrderItemLineDto {
  @ApiProperty({ format: 'uuid', description: 'Order line item id' })
  @IsUUID()
  orderItemId!: string;

  @ApiProperty({
    example: 2,
    description: 'New quantity. Set to 0 to remove the line.',
  })
  @IsInt()
  @Min(0)
  quantity!: number;
}

export class UpdateAdminOrderItemsDto {
  @ApiProperty({
    type: [UpdateAdminOrderItemLineDto],
    description: 'Updated quantities for existing order lines',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => UpdateAdminOrderItemLineDto)
  items!: UpdateAdminOrderItemLineDto[];

  @ApiPropertyOptional({
    description: 'Optional order-level note. Pass null/empty to clear.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string | null;
}
