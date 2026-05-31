export const DRIVER_DELIVERY_FEE_SHARE_PERCENT_KEY =
  'driver_delivery_fee_share_percent';

export const MERCHANT_FOOD_SHARE_PERCENT_KEY = 'merchant_food_share_percent';

export const DEFAULT_DRIVER_DELIVERY_FEE_SHARE_PERCENT = 60;
export const DEFAULT_MERCHANT_FOOD_SHARE_PERCENT = 100;

export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Merchant payout from food subtotal (e.g. 90% of $50 → $45). */
export function computeMerchantEarningsFromFoodSubtotal(
  foodSubtotal: number,
  sharePercent: number,
): number {
  if (!Number.isFinite(foodSubtotal) || foodSubtotal <= 0) {
    return 0;
  }
  const pct = clampSharePercent(sharePercent);
  return roundMoney((foodSubtotal * pct) / 100);
}

/** Driver payout from the customer delivery fee (e.g. 60% of $10 → $6). */
export function computeDriverEarningsFromDeliveryFee(
  deliveryFee: number,
  sharePercent: number,
): number {
  if (!Number.isFinite(deliveryFee) || deliveryFee <= 0) {
    return 0;
  }
  const pct = clampSharePercent(sharePercent);
  return roundMoney((deliveryFee * pct) / 100);
}

export function clampSharePercent(value: number): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_DRIVER_DELIVERY_FEE_SHARE_PERCENT;
  }
  return Math.min(100, Math.max(0, value));
}

export function platformSharePercent(participantSharePercent: number): number {
  return clampSharePercent(100 - clampSharePercent(participantSharePercent));
}
