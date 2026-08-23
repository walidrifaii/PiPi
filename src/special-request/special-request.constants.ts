export const SPECIAL_REQUEST_STATUSES = [
  'PENDING',
  'DELIVERING',
  'DISPATCHED',
  'DELIVERED',
  'CANCELLED',
] as const;
export type SpecialRequestStatus = (typeof SPECIAL_REQUEST_STATUSES)[number];

const TERMINAL: ReadonlySet<string> = new Set(['DELIVERED', 'CANCELLED']);

export const DRIVER_SPECIAL_REQUEST_OFFER_STATUSES = ['PENDING'] as const;
export const DRIVER_SPECIAL_REQUEST_ACTIVE_STATUSES = [
  'DELIVERING',
  'DISPATCHED',
] as const;

export const SPECIAL_REQUEST_IMAGE_MAX_BYTES = 2 * 1024 * 1024;

export const DEFAULT_SPECIAL_REQUEST_TIMEZONE = 'Africa/Tripoli';
export const DEFAULT_SPECIAL_REQUEST_NOW_MIN_MINUTES = 35;
export const DEFAULT_SPECIAL_REQUEST_NOW_MAX_MINUTES = 60;
/** Super-admin default buy/service fee charged on every special request. */
export const DEFAULT_SPECIAL_REQUEST_BUY_FEE = 3;

export function normalizeSpecialRequestStatus(
  value: string | null | undefined,
): SpecialRequestStatus {
  const raw = (value ?? 'PENDING').trim().toUpperCase();
  if ((SPECIAL_REQUEST_STATUSES as readonly string[]).includes(raw)) {
    return raw as SpecialRequestStatus;
  }
  return 'PENDING';
}

export function isTerminalSpecialRequestStatus(status: string): boolean {
  return TERMINAL.has(normalizeSpecialRequestStatus(status));
}

export function canAdminTransitionSpecialRequest(
  from: string,
  to: string,
): boolean {
  const current = normalizeSpecialRequestStatus(from);
  const next = normalizeSpecialRequestStatus(to);
  if (current === next) {
    return true;
  }
  if (TERMINAL.has(current)) {
    return false;
  }
  return (SPECIAL_REQUEST_STATUSES as readonly string[]).includes(next);
}
