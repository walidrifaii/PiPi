import { normalizeDeliveryTimeMinutes } from '../common/delivery-time-range';
import {
  resolveCustomerCoordinates,
  resolveMerchantCoordinates,
} from './order-coordinates';
import { computeDriverEarningsFromDeliveryFee } from '../platform-settings/driver-delivery-share';
import { findSnapshotItem } from './order.mapper';
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

/** Customer-facing money for drivers (what the customer ordered/paid — not merchant promo view). */
function resolveDriverOrderMoney(
  order: {
    subtotal?: { toString(): string } | null;
    total?: { toString(): string } | null;
    deliveryFee?: { toString(): string } | null;
  },
  snapshot: OrderItemsSnapshot | null,
) {
  const deliveryFee =
    snapshot?.deliveryFee ??
    (order.deliveryFee !== null && order.deliveryFee !== undefined
      ? Number(order.deliveryFee)
      : 0);
  const subtotal =
    snapshot?.customerSubtotal ??
    (order.subtotal !== null && order.subtotal !== undefined
      ? Number(order.subtotal)
      : null);
  const total =
    snapshot?.customerTotal ??
    (order.total !== null && order.total !== undefined
      ? Number(order.total)
      : null);

  return { deliveryFee, subtotal, total };
}

/** Lightweight card for driver offer list (uses snapshot items when present). */
export function mapDriverOrderOffer(order: {
  id: string;
  status: string | null;
  deliveryFee?: { toString(): string } | null;
  subtotal?: { toString(): string } | null;
  total?: { toString(): string } | null;
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
  driverSharePercent?: number;
}) {
  const snapshot = parseSnapshot(order.itemsSnapshot);
  const { deliveryFee, subtotal, total } = resolveDriverOrderMoney(
    order,
    snapshot,
  );
  const sharePercent = order.driverSharePercent ?? 100;
  const driverEarnings = computeDriverEarningsFromDeliveryFee(
    deliveryFee,
    sharePercent,
  );
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
    /** Full customer delivery fee. */
    deliveryFee,
    /** Driver payout (deliveryFee × share %). */
    fee: driverEarnings,
    driverEarnings,
    driverSharePercent: sharePercent,
    /** Customer order value (items only). */
    subtotal,
    /** Customer order total (items + delivery). */
    total,
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

export function mapDriverOrderDetail(
  order: OrderWithRelations,
  driverSharePercent?: number,
) {
  const base = mapDriverOrderOffer({
    ...order,
    driverSharePercent,
  });
  const snapshot = parseSnapshot(order.itemsSnapshot);
  const usedSnapIndexes = new Set<number>();
  const items = order.orderItems.map((oi) => {
    const snap = findSnapshotItem(oi, snapshot?.items, usedSnapIndexes);
    const unitPrice = snap?.unitPrice ?? Number(oi.unitPrice);
    const expectedTotal =
      Math.round(unitPrice * oi.quantity * 100) / 100;
    const snapTotal = snap?.totalPrice;
    const totalPrice =
      snapTotal != null && Math.abs(snapTotal - expectedTotal) < 0.02
        ? snapTotal
        : expectedTotal;
    return {
      productName: oi.productName,
      quantity: oi.quantity,
      unitPrice,
      totalPrice,
    };
  });

  return {
    ...base,
    items,
    deliveryTimeMinutes:
      normalizeDeliveryTimeMinutes(snapshot?.deliveryTimeMinutes) ?? null,
    customerPhone: order.user?.phone ?? null,
    notes: order.notes ?? null,
  };
}
