import { OrderItemsSnapshot } from './order.types';

function parseSnapshot(raw: unknown): OrderItemsSnapshot | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const s = raw as OrderItemsSnapshot;
  if (!Array.isArray(s.items)) {
    return null;
  }
  return s;
}

function toNum(value: { toString(): string } | number | null | undefined): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  const n = typeof value === 'number' ? value : Number(value.toString());
  return Number.isFinite(n) ? n : null;
}

/** Store location from merchant row (preferred for map routes). */
export function resolveMerchantCoordinates(order: {
  merchant: {
    latitude?: { toString(): string } | null;
    longitude?: { toString(): string } | null;
  };
}): { latitude: number | null; longitude: number | null } {
  return {
    latitude: toNum(order.merchant.latitude),
    longitude: toNum(order.merchant.longitude),
  };
}

/** Customer delivery point: saved address, else snapshot delivery coords from checkout. */
export function resolveCustomerCoordinates(order: {
  itemsSnapshot: unknown;
  address?: {
    latitude?: { toString(): string } | null;
    longitude?: { toString(): string } | null;
  } | null;
}): { latitude: number | null; longitude: number | null } {
  if (order.address?.latitude != null && order.address?.longitude != null) {
    return {
      latitude: toNum(order.address.latitude),
      longitude: toNum(order.address.longitude),
    };
  }
  const snapshot = parseSnapshot(order.itemsSnapshot);
  if (!snapshot) {
    return { latitude: null, longitude: null };
  }
  return {
    latitude: toNum(snapshot.latitude),
    longitude: toNum(snapshot.longitude),
  };
}
