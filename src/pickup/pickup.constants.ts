export const PICKUP_METHODS = ['NOW', 'SCHEDULED'] as const;
export type PickupMethod = (typeof PICKUP_METHODS)[number];

export const PICKUP_STATUSES = [
  'SCHEDULED',
  'PENDING',
  'DELIVERING',
  'DISPATCHED',
  'DELIVERED',
  'CANCELLED',
] as const;
export type PickupStatus = (typeof PICKUP_STATUSES)[number];

export const PICKUP_BLOCKED_APPLIES_TO = ['FROM', 'TO', 'BOTH'] as const;
export type PickupBlockedAppliesTo =
  (typeof PICKUP_BLOCKED_APPLIES_TO)[number];

export const PICKUP_LOCATION_ROLES = ['from', 'to'] as const;
export type PickupLocationRole = (typeof PICKUP_LOCATION_ROLES)[number];

export const PICKUP_WEEKDAY_NAMES: Record<number, string> = {
  1: 'Monday',
  2: 'Tuesday',
  3: 'Wednesday',
  4: 'Thursday',
  5: 'Friday',
  6: 'Saturday',
  7: 'Sunday',
};

const TERMINAL: ReadonlySet<string> = new Set(['DELIVERED', 'CANCELLED']);

export const DRIVER_PICKUP_OFFER_STATUSES = ['PENDING'] as const;
export const DRIVER_PICKUP_ACTIVE_STATUSES = [
  'DELIVERING',
  'DISPATCHED',
] as const;

export const DEFAULT_PICKUP_TIMEZONE = 'Africa/Tripoli';
export const DEFAULT_NOW_MIN_MINUTES = 35;
export const DEFAULT_NOW_MAX_MINUTES = 60;
export const DEFAULT_PICKUP_SERVICE_FEE = 0;
export const DEFAULT_PICKUP_FIXED_FEE = 100;
export const DEFAULT_PICKUP_MAX_FEE = 500;
export const DEFAULT_PICKUP_INCLUDED_KM = 10;
export const DEFAULT_PICKUP_KM_UNIT = 1;
export const DEFAULT_PICKUP_FEE_PER_UNIT = 20;
export const DEFAULT_PICKUP_MAX_KM = 30;

export const PICKUP_MONEY_TOLERANCE = 0.02;
export const PICKUP_DISTANCE_TOLERANCE_KM = 0.15;

export function normalizePickupStatus(
  value: string | null | undefined,
): PickupStatus {
  const raw = (value ?? 'PENDING').trim().toUpperCase();
  if ((PICKUP_STATUSES as readonly string[]).includes(raw)) {
    return raw as PickupStatus;
  }
  return 'PENDING';
}

export function isTerminalPickupStatus(status: string): boolean {
  return TERMINAL.has(normalizePickupStatus(status));
}

export function canAdminTransitionPickup(from: string, to: string): boolean {
  const current = normalizePickupStatus(from);
  const next = normalizePickupStatus(to);
  if (current === next) {
    return true;
  }
  if (TERMINAL.has(current)) {
    return false;
  }
  return (PICKUP_STATUSES as readonly string[]).includes(next);
}

export function appliesToMatchesRole(
  appliesTo: string,
  role: PickupLocationRole,
): boolean {
  const a = appliesTo.trim().toUpperCase();
  if (a === 'BOTH') {
    return true;
  }
  return role === 'from' ? a === 'FROM' : a === 'TO';
}
