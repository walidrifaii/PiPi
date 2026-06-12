import { PartialType } from '@nestjs/swagger';
import { CreateProductMerchantMultipartDto } from './create-product-merchant-multipart.dto';

/** Form fields for `PATCH /merchants/me/products/:id` (multipart; binary field `imageUrl`). */
export class UpdateProductMerchantMultipartDto extends PartialType(
  CreateProductMerchantMultipartDto,
) {}
