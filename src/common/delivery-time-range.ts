export type DeliveryTimeMinutesRange = {
  min: number;
  max: number;
};

/** Normalizes snapshot/API values; legacy orders stored a single number. */
export function normalizeDeliveryTimeMinutes(
  raw: unknown,
): DeliveryTimeMinutesRange | null {
  if (raw == null) {
    return null;
  }
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    const n = Math.round(raw);
    return { min: n, max: n };
  }
  if (typeof raw === 'object') {
    const o = raw as {
      min?: unknown;
      max?: unknown;
      minMinutes?: unknown;
      maxMinutes?: unknown;
    };
    const min = Number(o.min ?? o.minMinutes);
    const max = Number(o.max ?? o.maxMinutes);
    if (Number.isFinite(min) && Number.isFinite(max)) {
      return { min: Math.round(min), max: Math.round(max) };
    }
  }
  return null;
}
