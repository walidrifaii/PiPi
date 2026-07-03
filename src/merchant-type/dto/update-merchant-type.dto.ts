import { ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength, ValidateIf } from 'class-validator';
import { CreateMerchantTypeDto } from './create-merchant-type.dto';

export class UpdateMerchantTypeDto extends PartialType(
  OmitType(CreateMerchantTypeDto, ['imageUrl'] as const),
) {
  @ApiPropertyOptional({
    description: 'Image URL, or null to remove the current icon.',
    nullable: true,
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @Transform(({ value }) =>
    typeof value === 'string' && value.trim() === '' ? null : value,
  )
  @IsString()
  @MaxLength(500)
  imageUrl?: string | null;
}
