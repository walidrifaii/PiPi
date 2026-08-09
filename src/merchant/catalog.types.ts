import type { ProductOptionGroupView } from './product-option.types';

/** Flattened product row for listings and legacy clients */
export type UnifiedProduct = {
  id: string;
  name: string;
  nameAr: string | null;
  description: string | null;
  descriptionAr: string | null;
  price: number;
  /** Computed sale price from merchant offer, when active */
  discountPrice: number | null;
  /** True when a merchant offer lowers the charged price below list `price` */
  hasDiscount: boolean;
  /** Price charged at checkout: offer price when on sale, otherwise `price` */
  effectivePrice: number;
  /** True when the product has at least one option group with choices */
  hasOptions: boolean;
  images: string[];
  category: string;
  categoryAr: string | null;
  /** Present on product detail responses when hasOptions is true */
  optionGroups?: ProductOptionGroupView[];
};
