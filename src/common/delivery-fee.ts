import { haversineDistanceKm } from './haversine';

export const DEFAULT_FIXED_FEE = 1.5;
export const DEFAULT_KM_UNIT = 1;
export const DEFAULT_FEE_PER_UNIT = 0;

export type DeliveryFeeFormula = {
  fixedFee: number;
  kmUnit: number;
  feePerUnit: number;
};

export const DEFAULT_DELIVERY_FEE_FORMULA: DeliveryFeeFormula = {
  fixedFee: DEFAULT_FIXED_FEE,
  kmUnit: DEFAULT_KM_UNIT,
  feePerUnit: DEFAULT_FEE_PER_UNIT,
};

/** Saved/displayed breakdown: admin rates + computed total only. */
export type DeliveryFeeBreakdown = {
  fixedFee: number;
  kmUnit: number;
  feePerUnit: number;
  deliveryFee: number;
};

export function roundMoney(amount: number): number {
  return Math.round(amount * 100) / 100;
}

/** Total = fixedFee + ceil(distanceKm / kmUnit) × feePerUnit */
export function computeDeliveryFeeBreakdown(
  distanceKm: number,
  formula: DeliveryFeeFormula = DEFAULT_DELIVERY_FEE_FORMULA,
): DeliveryFeeBreakdown {
  const fixedFee =
    Number.isFinite(formula.fixedFee) && formula.fixedFee >= 0
      ? formula.fixedFee
      : DEFAULT_FIXED_FEE;
  const kmUnit =
    Number.isFinite(formula.kmUnit) && formula.kmUnit > 0
      ? formula.kmUnit
      : DEFAULT_KM_UNIT;
  const feePerUnit =
    Number.isFinite(formula.feePerUnit) && formula.feePerUnit >= 0
      ? formula.feePerUnit
      : DEFAULT_FEE_PER_UNIT;

  const distance =
    Number.isFinite(distanceKm) && distanceKm > 0 ? distanceKm : 0;
  const chargedKmUnits = distance > 0 ? Math.ceil(distance / kmUnit) : 0;
  const deliveryFee = roundMoney(fixedFee + chargedKmUnits * feePerUnit);

  return {
    fixedFee: roundMoney(fixedFee),
    kmUnit: roundMoney(kmUnit),
    feePerUnit: roundMoney(feePerUnit),
    deliveryFee,
  };
}

export function computeDeliveryFeeFromDistanceKm(
  distanceKm: number,
  formula: DeliveryFeeFormula = DEFAULT_DELIVERY_FEE_FORMULA,
): number {
  return computeDeliveryFeeBreakdown(distanceKm, formula).deliveryFee;
}

export function deliveryFeeBetweenPoints(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number,
  formula: DeliveryFeeFormula = DEFAULT_DELIVERY_FEE_FORMULA,
): DeliveryFeeBreakdown {
  const distanceKm = haversineDistanceKm(fromLat, fromLng, toLat, toLng);
  return computeDeliveryFeeBreakdown(distanceKm, formula);
}
