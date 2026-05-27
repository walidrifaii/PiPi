import {
  resolveCustomerCoordinates,
  resolveMerchantCoordinates,
} from './order-coordinates';
import { OrderItemsSnapshot, OrderWithRelations } from './order.types';

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

/** Lightweight card for driver offer list (uses snapshot items when present). */
export function mapDriverOrderOffer(order: {
  id: string;
  status: string | null;
  deliveryFee: { toString(): string } | null;
  itemsSnapshot: unknown;
  createdAt: Date;
  merchant: {
    name: string;
    latitude?: { toString(): string } | null;
    longitude?: { toString(): string } | null;
  };
  user?: { fullName: string | null } | null;
  address?: {
    addressLine: string;
    latitude?: { toString(): string };
    longitude?: { toString(): string };
  } | null;
  orderItems?: Array<{ productName: string }>;
}) {
  const snapshot = parseSnapshot(order.itemsSnapshot);
  const itemNames =
    snapshot?.items.map((i) => i.productName) ??
    order.orderItems?.map((i) => i.productName) ??
    [];
  const itemsSummary =
    itemNames.length > 0
      ? itemNames.join(', ').slice(0, 280)
      : 'Order items';

  const merchantCoords = resolveMerchantCoordinates(order);
  const customerCoords = resolveCustomerCoordinates(order);

  return {
    id: order.id,
    status: order.status,
    merchantName: snapshot?.merchantName ?? order.merchant.name,
    merchantAddress: snapshot?.merchantName ?? order.merchant.name,
    customerName: order.user?.fullName?.trim() || 'Customer',
    customerAddress: order.address?.addressLine ?? 'Delivery address',
    fee: order.deliveryFee !== null ? Number(order.deliveryFee) : 0,
    distanceKm: snapshot?.distanceKm ?? null,
    itemCount: itemNames.length,
    itemsSummary,
    createdAt: order.createdAt,
    merchantLatitude: merchantCoords.latitude,
    merchantLongitude: merchantCoords.longitude,
    customerLatitude: customerCoords.latitude,
    customerLongitude: customerCoords.longitude,
  };
}

export function mapDriverOrderDetail(order: OrderWithRelations) {
  const base = mapDriverOrderOffer(order);
  const snapshot = parseSnapshot(order.itemsSnapshot);
  return {
    ...base,
    deliveryTimeMinutes: snapshot?.deliveryTimeMinutes ?? null,
    customerPhone: order.user?.phone ?? null,
  };
}
