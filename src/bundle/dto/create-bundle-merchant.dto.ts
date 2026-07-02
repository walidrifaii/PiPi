import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { parseOptionalFormBoolean } from '../../banner/dto/banner-form-boolean.transform';

export class CreateBundleMerchantDto {
  @ApiProperty({ example: 'Family meal deal' })
  @IsString()
  @MaxLength(255)
  title!: string;

  @ApiPropertyOptional({ example: 'وجبة عائلية' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  titleAr?: string;

  @ApiPropertyOptional({ example: '2 burgers, fries and drinks' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 'برجر مع بطاطا ومشروبات' })
  @IsOptional()
  @IsString()
  descriptionAr?: string;

  @ApiProperty({ example: 24.99, minimum: 0.01 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  price!: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @Transform(({ value }) => parseOptionalFormBoolean(value))
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ default: 0, minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
