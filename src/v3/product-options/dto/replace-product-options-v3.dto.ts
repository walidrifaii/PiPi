import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, ValidateNested } from 'class-validator';
import { ProductOptionGroupDto } from '../../../merchant-catalog/dto/product-option.dto';

export class ReplaceProductOptionsV3Dto {
  @ApiProperty({
    type: [ProductOptionGroupDto],
    description:
      'Replaces all option groups on the product. Send [] to remove every option.',
    example: [
      {
        name: 'Size',
        nameAr: 'الحجم',
        isRequired: true,
        minSelect: 1,
        maxSelect: 1,
        choices: [
          { name: 'Small', nameAr: 'صغير', priceModifier: 0 },
          { name: 'Medium', nameAr: 'وسط', priceModifier: 2 },
          { name: 'Large', nameAr: 'كبير', priceModifier: 4 },
        ],
      },
      {
        name: 'Extras',
        nameAr: 'إضافات',
        isRequired: false,
        minSelect: 0,
        maxSelect: 3,
        choices: [
          { name: 'Extra Kaju', nameAr: 'كاجو إضافي', priceModifier: 3 },
        ],
      },
    ],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductOptionGroupDto)
  optionGroups!: ProductOptionGroupDto[];
}
