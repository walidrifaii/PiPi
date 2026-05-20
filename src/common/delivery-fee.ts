import { haversineDistanceKm } from './haversine';

/** $1 per 5 km block (minimum one block). */
export const DELIVERY_KM_BLOCK = 5;
export const DELIVERY_FEE_PER_BLOCK = 1;

export function computeDeliveryFeeFromDistanceKm(distanceKm: number): number {
  if (!Number.isFinite(distanceKm) || distanceKm <= 0) {
    return DELIVERY_FEE_PER_BLOCK;
  }
  const blocks = Math.ceil(distanceKm / DELIVERY_KM_BLOCK);
  return blocks * DELIVERY_FEE_PER_BLOCK;
}

export function deliveryFeeBetweenPoints(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number,
): { distanceKm: number; deliveryFee: number } {
  const distanceKm = haversineDistanceKm(fromLat, fromLng, toLat, toLng);
  return {
    distanceKm: Math.round(distanceKm * 1000) / 1000,
    deliveryFee: computeDeliveryFeeFromDistanceKm(distanceKm),
  };
}
