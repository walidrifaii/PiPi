import type { ProductOptionGroupView } from './product-option.types';

/** Flattened product row for listings and legacy clients */
export type UnifiedProduct = {
  id: string;
  name: string;
  nameAr: string | null;
  description: string | null;
  descriptionAr: string | null;
  price: number;
  discountPrice: number | null;
  /** True when `discountPrice` is set and lower than `price` */
  hasDiscount: boolean;
  /** Price charged at checkout: `discountPrice` when on sale, otherwise `price` */
  effectivePrice: number;
  images: string[];
  category: string;
  categoryAr: string | null;
  optionGroups: ProductOptionGroupView[];
};
