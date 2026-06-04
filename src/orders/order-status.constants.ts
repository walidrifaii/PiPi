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

/** Merchant may only accept or cancel new orders; accepted orders leave their queue. */
const MERCHANT_TRANSITIONS: Record<string, readonly string[]> = {
  PENDING: ['ACCEPTED', 'CANCELLED'],
  ACCEPTED: [],
  PREPARING: [],
  READY: [],
  DISPATCHED: [],
  DELIVERING: [],
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

/** Unassigned offers after merchant accept (status ACCEPTED, no driver). */
export const DRIVER_OFFER_STATUSES = ['ACCEPTED'] as const;

/** Assigned orders the driver is fulfilling (to merchant or to customer). */
export const DRIVER_ACTIVE_STATUSES = ['DELIVERING', 'DISPATCHED'] as const;

/**
 * Max orders a driver may carry at once. Additional orders are only allowed
 * when they belong to the SAME merchant as the driver's current delivery
 * (same pickup point), so the driver can batch multiple orders from one store.
 */
export const MAX_DRIVER_BATCH_ORDERS = 3;

/** Customer live tracking after driver accept (status DELIVERING). */
export const CUSTOMER_TRACKABLE_STATUSES = ['DELIVERING', 'DISPATCHED'] as const;

export function isCustomerTrackableStatus(
  status: string | null | undefined,
): boolean {
  const s = normalizeOrderStatus(status);
  return (CUSTOMER_TRACKABLE_STATUSES as readonly string[]).includes(s);
}

/** Customer ↔ driver chat and phone while delivery is active. */
export function isOrderContactableStatus(
  status: string | null | undefined,
): boolean {
  return isCustomerTrackableStatus(status);
}

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
