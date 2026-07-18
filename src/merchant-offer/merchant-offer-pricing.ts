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
 * Active offer: apply offer % to list price. Otherwise charge list price.
 */
export function resolveStorefrontProductPricing(
  listPrice: number,
  merchantOfferPercent: number | null,
): {
  price: number;
  discountPrice: number | null;
  hasDiscount: boolean;
  effectivePrice: number;
  merchantOfferPercent: number | null;
} {
  const price = Number(listPrice);

  if (merchantOfferPercent !== null && merchantOfferPercent > 0) {
    const offerApplied = computeOfferDiscountPrice(price, merchantOfferPercent);
    const hasDiscount = offerApplied < price;
    return {
      price,
      discountPrice: hasDiscount ? offerApplied : null,
      hasDiscount,
      effectivePrice: hasDiscount ? offerApplied : price,
      merchantOfferPercent,
    };
  }

  return {
    price,
    discountPrice: null,
    hasDiscount: false,
    effectivePrice: price,
    merchantOfferPercent: null,
  };
}

/** Effective unit sale price before option modifiers. */
export function resolveStorefrontUnitBasePrice(
  listPrice: number,
  merchantOfferPercent: number | null,
): number {
  return resolveStorefrontProductPricing(listPrice, merchantOfferPercent)
    .effectivePrice;
}
