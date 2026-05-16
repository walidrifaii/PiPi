import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, Min } from 'class-validator';
import { parseOptionalFormBoolean } from './banner-form-boolean.transform';

export class CreateBannerDto {
  @ApiPropertyOptional({
    description: 'When false, banner is hidden from the storefront carousel',
    default: true,
  })
  @IsOptional()
  @Transform(({ value }) => parseOptionalFormBoolean(value))
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Lower sorts first in the carousel', default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
