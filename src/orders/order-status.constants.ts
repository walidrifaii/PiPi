export const ORDER_STATUSES = [
  'PENDING',
  'ACCEPTED',
  'PREPARING',
  'READY',
  'DISPATCHED',
  'DELIVERING',
  'DELIVERED',
  'CANCELLED',
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

const TERMINAL: ReadonlySet<string> = new Set(['DELIVERED', 'CANCELLED']);

/** Allowed next statuses from each current status (merchant flow). */
const MERCHANT_TRANSITIONS: Record<string, readonly string[]> = {
  PENDING: ['ACCEPTED', 'CANCELLED'],
  ACCEPTED: ['PREPARING', 'CANCELLED'],
  PREPARING: ['READY', 'DISPATCHED', 'DELIVERING', 'CANCELLED'],
  READY: ['DISPATCHED', 'DELIVERING', 'CANCELLED'],
  DISPATCHED: ['DELIVERING', 'DELIVERED', 'CANCELLED'],
  DELIVERING: ['DELIVERED', 'CANCELLED'],
  DELIVERED: [],
  CANCELLED: [],
};

export function normalizeOrderStatus(
  value: string | null | undefined,
): OrderStatus {
  const raw = (value ?? 'PENDING').trim().toUpperCase();
  if ((ORDER_STATUSES as readonly string[]).includes(raw)) {
    return raw as OrderStatus;
  }
  return 'PENDING';
}

export function isTerminalOrderStatus(status: string): boolean {
  return TERMINAL.has(normalizeOrderStatus(status));
}

export function canMerchantTransition(from: string, to: string): boolean {
  const current = normalizeOrderStatus(from);
  const next = normalizeOrderStatus(to);
  const allowed = MERCHANT_TRANSITIONS[current] ?? [];
  return allowed.includes(next);
}

/** Orders visible in the driver app offer list (unassigned). */
export const DRIVER_OFFER_STATUSES = ['READY', 'DISPATCHED'] as const;

/** Orders the driver is actively delivering. */
export const DRIVER_ACTIVE_STATUSES = ['DISPATCHED', 'DELIVERING'] as const;

export function isDriverOfferStatus(status: string | null | undefined): boolean {
  const s = normalizeOrderStatus(status);
  return (DRIVER_OFFER_STATUSES as readonly string[]).includes(s);
}

export function isDriverActiveStatus(status: string | null | undefined): boolean {
  const s = normalizeOrderStatus(status);
  return (DRIVER_ACTIVE_STATUSES as readonly string[]).includes(s);
}

export function canSuperAdminTransition(from: string, to: string): boolean {
  const current = normalizeOrderStatus(from);
  const next = normalizeOrderStatus(to);
  if (current === next) {
    return true;
  }
  if (TERMINAL.has(current)) {
    return false;
  }
  return (ORDER_STATUSES as readonly string[]).includes(next);
}
