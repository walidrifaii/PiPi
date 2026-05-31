/** Sale price after a store promo percentage (2 decimal places). */
export function computeOfferDiscountPrice(
  listPrice: number,
  discountPercent: number,
): number {
  const discounted = Number(listPrice) * (1 - Number(discountPercent) / 100);
  return Math.round(discounted * 100) / 100;
}

/**
 * Storefront/checkout price with optional merchant promo.
 * - Active offer: apply offer % to product discount_price when set, else to list price.
 * - No offer: use product discount_price when set, else list price.
 */
export function resolveStorefrontProductPricing(
  listPrice: number,
  storedDiscountPrice: number | null,
  merchantOfferPercent: number | null,
): {
  price: number;
  discountPrice: number | null;
  hasDiscount: boolean;
  effectivePrice: number;
  merchantOfferPercent: number | null;
} {
  const price = Number(listPrice);
  const productSale =
    storedDiscountPrice !== null && storedDiscountPrice < price
      ? Number(storedDiscountPrice)
      : null;

  if (merchantOfferPercent !== null && merchantOfferPercent > 0) {
    const offerBase = productSale !== null ? productSale : price;
    const offerApplied = computeOfferDiscountPrice(
      offerBase,
      merchantOfferPercent,
    );
    const hasDiscount = offerApplied < price;
    return {
      price,
      discountPrice: hasDiscount ? offerApplied : null,
      hasDiscount,
      effectivePrice: hasDiscount ? offerApplied : price,
      merchantOfferPercent,
    };
  }

  const hasDiscount = productSale !== null;
  return {
    price,
    discountPrice: productSale,
    hasDiscount,
    effectivePrice: hasDiscount ? productSale! : price,
    merchantOfferPercent: null,
  };
}

/** Effective unit sale price before option modifiers. */
export function resolveStorefrontUnitBasePrice(
  listPrice: number,
  storedDiscountPrice: number | null,
  merchantOfferPercent: number | null,
): number {
  return resolveStorefrontProductPricing(
    listPrice,
    storedDiscountPrice,
    merchantOfferPercent,
  ).effectivePrice;
}
