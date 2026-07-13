import { resolveUnitPriceWithOptions } from '../common/product-option-pricing';
import { normalizeDeliveryTimeMinutes } from '../common/delivery-time-range';
import { computeMerchantEarningsFromFoodSubtotal } from '../platform-settings/driver-delivery-share';
import {
  resolveCustomerCoordinates,
  resolveMerchantCoordinates,
} from './order-coordinates';
import {
  OrderDetailAudience,
  OrderItemsSnapshot,
  OrderWithRelations,
} from './order.types';

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

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Match snapshot lines to DB orderItems by product/bundle (not array index).
 * Prisma include order is not guaranteed to match create order, so index
 * matching swaps merchantUnitPrice/merchantTotalPrice across lines.
 */
export function findSnapshotItem(
  oi: OrderWithRelations['orderItems'][number],
  snapshotItems: OrderItemsSnapshot['items'] | undefined,
  usedIndexes: Set<number>,
): OrderItemsSnapshot['items'][number] | undefined {
  if (!snapshotItems?.length) return undefined;

  const take = (predicate: (s: OrderItemsSnapshot['items'][number]) => boolean) => {
    for (let i = 0; i < snapshotItems.length; i++) {
      if (usedIndexes.has(i)) continue;
      if (!predicate(snapshotItems[i])) continue;
      usedIndexes.add(i);
      return snapshotItems[i];
    }
    return undefined;
  };

  const sameCatalog = (s: OrderItemsSnapshot['items'][number]) =>
    (oi.productId != null && s.productId === oi.productId) ||
    (oi.bundleId != null && s.bundleId === oi.bundleId);

  return (
    take((s) => sameCatalog(s) && s.quantity === oi.quantity) ??
    take((s) => sameCatalog(s)) ??
    take(
      (s) =>
        s.productName === oi.productName && s.quantity === oi.quantity,
    ) ??
    take((s) => s.productName === oi.productName)
  );
}

type MappedOrderItem = {
  id: string;
  productId: string | null;
  bundleId?: string | null;
  productName: string;
  imageUrl: string | null;
  quantity: number;
  price: number;
  discountPrice: number | null;
  unitPrice: number;
  totalPrice: number;
  message: string | null;
  selectedOptions: NonNullable<OrderItemsSnapshot['items'][number]['selectedOptions']>;
};

function mapOrderItem(
  oi: OrderWithRelations['orderItems'][number],
  snap: OrderItemsSnapshot['items'][number] | undefined,
  snapshot: OrderItemsSnapshot | null,
  audience: OrderDetailAudience,
  productImages?: Map<string, string | null>,
): MappedOrderItem {
  const listPrice = snap?.listPrice ?? Number(oi.unitPrice);
  const modifiers =
    snap?.selectedOptions?.map((o) => Number(o.priceModifier)) ?? [];
  const imageUrl =
    snap?.imageUrl ??
    (oi.productId ? productImages?.get(oi.productId) ?? null : null);

  if (audience === 'merchant') {
    const productDiscount =
      snap?.productDiscountPrice !== undefined
        ? snap.productDiscountPrice
        : snapshot?.merchantOfferPercent
          ? null
          : (snap?.discountPrice ?? null);

    const merchantUnit =
      snap?.merchantUnitPrice ??
      resolveUnitPriceWithOptions(listPrice, productDiscount, modifiers);
    const expectedTotal = roundMoney(merchantUnit * oi.quantity);
    const snapTotal = snap?.merchantTotalPrice;
    const merchantTotal =
      snapTotal != null && Math.abs(snapTotal - expectedTotal) < 0.02
        ? snapTotal
        : expectedTotal;

    return {
      id: oi.id,
      productId: oi.productId,
      bundleId: oi.bundleId ?? snap?.bundleId ?? null,
      productName: oi.productName,
      imageUrl,
      quantity: oi.quantity,
      price: listPrice,
      discountPrice: productDiscount,
      unitPrice: merchantUnit,
      totalPrice: merchantTotal,
      message: snap?.message ?? null,
      selectedOptions: snap?.selectedOptions ?? [],
    };
  }

  return {
    id: oi.id,
    productId: oi.productId,
    bundleId: oi.bundleId ?? snap?.bundleId ?? null,
    productName: oi.productName,
    imageUrl,
    quantity: oi.quantity,
    price: listPrice,
    discountPrice: snap?.discountPrice ?? null,
    unitPrice: Number(oi.unitPrice),
    totalPrice: Number(oi.totalPrice),
    message: snap?.message ?? null,
    selectedOptions: snap?.selectedOptions ?? [],
  };
}

function resolveOrderTotals(
  order: OrderWithRelations,
  snapshot: OrderItemsSnapshot | null,
  items: MappedOrderItem[],
  audience: OrderDetailAudience,
  merchantFoodSharePercent?: number,
) {
  const deliveryFeeFromOrder =
    order.deliveryFee !== null ? Number(order.deliveryFee) : null;
  const deliveryFee =
    snapshot?.deliveryFee !== undefined && snapshot.deliveryFee !== null
      ? snapshot.deliveryFee
      : deliveryFeeFromOrder;

  if (audience === 'merchant') {
    const share = merchantFoodSharePercent ?? 100;
    let grossSubtotal: number;

    if (snapshot?.merchantSubtotal !== undefined) {
      grossSubtotal = snapshot.merchantSubtotal;
    } else {
      grossSubtotal = roundMoney(
        items.reduce((sum, item) => sum + item.totalPrice, 0),
      );
    }

    const subtotal = computeMerchantEarningsFromFoodSubtotal(
      grossSubtotal,
      share,
    );

    return {
      subtotal,
      deliveryFee: null,
      total: subtotal,
    };
  }

  return {
    subtotal: order.subtotal !== null ? Number(order.subtotal) : null,
    deliveryFee,
    total: order.total !== null ? Number(order.total) : null,
  };
}

function offerFieldsForAudience(
  snapshot: OrderItemsSnapshot | null,
  audience: OrderDetailAudience,
) {
  if (audience === 'merchant') {
    return {};
  }

  const fields: Record<string, number> = {};
  const percent = snapshot?.merchantOfferPercent;
  if (percent !== null && percent !== undefined && percent > 0) {
    fields.merchantOfferPercent = percent;
  }

  if (audience === 'admin') {
    if (snapshot?.merchantSubtotal !== undefined) {
      fields.merchantSubtotal = snapshot.merchantSubtotal;
      fields.merchantTotal = snapshot.merchantSubtotal;
    } else if (snapshot?.merchantTotal !== undefined) {
      fields.merchantTotal = snapshot.merchantTotal;
    }
  }

  return fields;
}

export function mapOrderSummary(
  order: OrderWithRelations,
  audience: OrderDetailAudience = 'customer',
  merchantFoodSharePercent?: number,
) {
  const snapshot = parseSnapshot(order.itemsSnapshot);
  const usedSnapIndexes = new Set<number>();
  const items = order.orderItems.map((oi) =>
    mapOrderItem(
      oi,
      findSnapshotItem(oi, snapshot?.items, usedSnapIndexes),
      snapshot,
      audience,
    ),
  );
  const totals = resolveOrderTotals(
    order,
    snapshot,
    items,
    audience,
    merchantFoodSharePercent,
  );

  return {
    id: order.id,
    checkoutRef: order.checkoutRef,
    status: order.status,
    merchantId: order.merchantId,
    merchantName: snapshot?.merchantName ?? order.merchant.name,
    logoUrl: order.merchant.imageUrl ?? null,
    subtotal: totals.subtotal,
    deliveryFee: totals.deliveryFee,
    total: totals.total,
    distanceKm: snapshot?.distanceKm ?? null,
    deliveryTimeMinutes:
      normalizeDeliveryTimeMinutes(snapshot?.deliveryTimeMinutes) ?? null,
    itemCount: order.orderItems.length,
    createdAt: order.createdAt,
    preparationTime: order.preparationTime ?? null,
    ...offerFieldsForAudience(snapshot, audience),
  };
}

export function mapOrderDetail(
  order: OrderWithRelations,
  options: {
    includeCustomer?: boolean;
    audience?: OrderDetailAudience;
    productImages?: Map<string, string | null>;
    merchantFoodSharePercent?: number;
  } = {},
) {
  const audience = options.audience ?? 'customer';
  const snapshot = parseSnapshot(order.itemsSnapshot);
  const merchantCoords = resolveMerchantCoordinates(order);
  const customerCoords = resolveCustomerCoordinates(order);
  const usedSnapIndexes = new Set<number>();
  const items = order.orderItems.map((oi) =>
    mapOrderItem(
      oi,
      findSnapshotItem(oi, snapshot?.items, usedSnapIndexes),
      snapshot,
      audience,
      options.productImages,
    ),
  );
  const totals = resolveOrderTotals(
    order,
    snapshot,
    items,
    audience,
    options.merchantFoodSharePercent,
  );

  return {
    id: order.id,
    checkoutRef: order.checkoutRef,
    status: order.status,
    merchantId: order.merchantId,
    merchantName: snapshot?.merchantName ?? order.merchant.name,
    merchant: {
      id: order.merchant.id,
      name: snapshot?.merchantName ?? order.merchant.name,
      logoUrl: order.merchant.imageUrl ?? null,
    },
    latitude: merchantCoords.latitude,
    longitude: merchantCoords.longitude,
    customerLatitude: customerCoords.latitude,
    customerLongitude: customerCoords.longitude,
    distanceKm: snapshot?.distanceKm ?? null,
    deliveryTimeMinutes:
      normalizeDeliveryTimeMinutes(snapshot?.deliveryTimeMinutes) ?? null,
    addressId: order.addressId,
    address: order.address
      ? {
          id: order.address.id,
          addressLine: order.address.addressLine,
          latitude: Number(order.address.latitude),
          longitude: Number(order.address.longitude),
        }
      : null,
    subtotal: totals.subtotal,
    deliveryFee: totals.deliveryFee,
    total: totals.total,
    notes: order.notes,
    items,
    createdAt: order.createdAt,
    preparationTime: order.preparationTime ?? null,
    ...offerFieldsForAudience(snapshot, audience),
    ...(order.driverId && order.driver
      ? {
          driver: {
            id: order.driver.id,
            fullName: order.driver.fullName,
            vehicleType: order.driver.vehicleType,
          },
        }
      : {}),
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
