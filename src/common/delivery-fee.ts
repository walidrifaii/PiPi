import { haversineDistanceKm } from './haversine';

export const DEFAULT_FIXED_FEE = 1.5;
export const DEFAULT_INCLUDED_KM = 10;
export const DEFAULT_KM_UNIT = 1;
export const DEFAULT_FEE_PER_UNIT = 1;
export const DEFAULT_MAX_FEE = 15;
export const DEFAULT_MAX_KM = 30;

export type DeliveryFeeFormula = {
  /** Minimum / flat price for distance up to includedKm. */
  fixedFee: number;
  /** Km included in fixedFee only (no extra charge inside this radius). */
  includedKm: number;
  /** Bill extra distance in steps of this many km. */
  kmUnit: number;
  /** Price per km step beyond includedKm. */
  feePerUnit: number;
  /** Never charge more than this amount. */
  maxFee: number;
  /** Bill using at most this many km (longer trips pay the same as maxKm). */
  maxKm: number;
};

export const DEFAULT_DELIVERY_FEE_FORMULA: DeliveryFeeFormula = {
  fixedFee: DEFAULT_FIXED_FEE,
  includedKm: DEFAULT_INCLUDED_KM,
  kmUnit: DEFAULT_KM_UNIT,
  feePerUnit: DEFAULT_FEE_PER_UNIT,
  maxFee: DEFAULT_MAX_FEE,
  maxKm: DEFAULT_MAX_KM,
};

/** Saved/displayed breakdown: admin rates + computed total only. */
export type DeliveryFeeBreakdown = {
  fixedFee: number;
  includedKm: number;
  kmUnit: number;
  feePerUnit: number;
  maxFee: number;
  maxKm: number;
  deliveryFee: number;
};

export function roundMoney(amount: number): number {
  return Math.round(amount * 100) / 100;
}

function clampFee(raw: number, min: number, max: number): number {
  return roundMoney(Math.min(Math.max(raw, min), max));
}

/**
 * Distance billed = min(actualKm, maxKm).
 * Within includedKm → only fixedFee.
 * Beyond → fixedFee + ceil((billed - includedKm) / kmUnit) × feePerUnit.
 * Result capped at maxFee.
 */
export function computeDeliveryFeeBreakdown(
  distanceKm: number,
  formula: DeliveryFeeFormula = DEFAULT_DELIVERY_FEE_FORMULA,
): DeliveryFeeBreakdown {
  const fixedFee =
    Number.isFinite(formula.fixedFee) && formula.fixedFee >= 0
      ? formula.fixedFee
      : DEFAULT_FIXED_FEE;
  const includedKm =
    Number.isFinite(formula.includedKm) && formula.includedKm > 0
      ? formula.includedKm
      : DEFAULT_INCLUDED_KM;
  const kmUnit =
    Number.isFinite(formula.kmUnit) && formula.kmUnit > 0
      ? formula.kmUnit
      : DEFAULT_KM_UNIT;
  const feePerUnit =
    Number.isFinite(formula.feePerUnit) && formula.feePerUnit >= 0
      ? formula.feePerUnit
      : DEFAULT_FEE_PER_UNIT;
  const maxFee =
    Number.isFinite(formula.maxFee) && formula.maxFee >= fixedFee
      ? formula.maxFee
      : Math.max(fixedFee, DEFAULT_MAX_FEE);
  const maxKm =
    Number.isFinite(formula.maxKm) && formula.maxKm >= includedKm
      ? formula.maxKm
      : Math.max(includedKm, DEFAULT_MAX_KM);

  const actualKm =
    Number.isFinite(distanceKm) && distanceKm > 0
      ? Math.round(distanceKm * 1000) / 1000
      : 0;
  const billedKm = Math.min(actualKm, maxKm);

  let raw: number;
  if (billedKm <= includedKm) {
    raw = fixedFee;
  } else {
    const extraKm = billedKm - includedKm;
    const extraUnits = Math.ceil(extraKm / kmUnit);
    raw = fixedFee + extraUnits * feePerUnit;
  }

  const deliveryFee = clampFee(raw, fixedFee, maxFee);

  return {
    fixedFee: roundMoney(fixedFee),
    includedKm: roundMoney(includedKm),
    kmUnit: roundMoney(kmUnit),
    feePerUnit: roundMoney(feePerUnit),
    maxFee: roundMoney(maxFee),
    maxKm: roundMoney(maxKm),
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
