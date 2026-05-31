export const DRIVER_DELIVERY_FEE_SHARE_PERCENT_KEY =
  'driver_delivery_fee_share_percent';

export const DEFAULT_DRIVER_DELIVERY_FEE_SHARE_PERCENT = 60;

export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
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
