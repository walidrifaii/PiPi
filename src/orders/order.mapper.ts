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

export function mapOrderSummary(order: OrderWithRelations) {
  const snapshot = parseSnapshot(order.itemsSnapshot);
  return {
    id: order.id,
    checkoutRef: order.checkoutRef,
    status: order.status,
    merchantId: order.merchantId,
    merchantName: snapshot?.merchantName ?? order.merchant.name,
    subtotal: order.subtotal !== null ? Number(order.subtotal) : null,
    deliveryFee:
      order.deliveryFee !== null ? Number(order.deliveryFee) : null,
    total: order.total !== null ? Number(order.total) : null,
    distanceKm: snapshot?.distanceKm ?? null,
    deliveryTimeMinutes: snapshot?.deliveryTimeMinutes ?? null,
    itemCount: order.orderItems.length,
    createdAt: order.createdAt,
  };
}

export function mapOrderDetail(
  order: OrderWithRelations,
  options: { includeCustomer?: boolean } = {},
) {
  const snapshot = parseSnapshot(order.itemsSnapshot);
  const items = order.orderItems.map((oi, index) => {
    const snap = snapshot?.items[index];
    return {
      id: oi.id,
      productId: oi.productId,
      productName: oi.productName,
      quantity: oi.quantity,
      price: snap?.listPrice ?? Number(oi.unitPrice),
      discountPrice: snap?.discountPrice ?? null,
      unitPrice: Number(oi.unitPrice),
      totalPrice: Number(oi.totalPrice),
      message: snap?.message ?? null,
    };
  });

  return {
    id: order.id,
    checkoutRef: order.checkoutRef,
    status: order.status,
    merchantId: order.merchantId,
    merchantName: snapshot?.merchantName ?? order.merchant.name,
    merchant: {
      id: order.merchant.id,
      name: snapshot?.merchantName ?? order.merchant.name,
    },
    latitude: snapshot?.latitude ?? null,
    longitude: snapshot?.longitude ?? null,
    distanceKm: snapshot?.distanceKm ?? null,
    deliveryTimeMinutes: snapshot?.deliveryTimeMinutes ?? null,
    addressId: order.addressId,
    address: order.address
      ? {
          id: order.address.id,
          addressLine: order.address.addressLine,
          latitude: Number(order.address.latitude),
          longitude: Number(order.address.longitude),
        }
      : null,
    subtotal: order.subtotal !== null ? Number(order.subtotal) : null,
    deliveryFee:
      order.deliveryFee !== null ? Number(order.deliveryFee) : null,
    total: order.total !== null ? Number(order.total) : null,
    notes: order.notes,
    items,
    createdAt: order.createdAt,
    ...(options.includeCustomer && order.user
      ? {
          customer: {
            id: order.user.id,
            fullName: order.user.fullName,
            phone: order.user.phone,
          },
        }
      : {}),
  };
}
