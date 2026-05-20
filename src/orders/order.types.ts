export type OrderItemsSnapshot = {
  merchantName: string;
  latitude: number;
  longitude: number;
  distanceKm: number;
  deliveryTimeMinutes: number;
  items: Array<{
    productId: string;
    productName: string;
    quantity: number;
    listPrice: number;
    discountPrice: number | null;
    unitPrice: number;
    totalPrice: number;
    message: string | null;
  }>;
};

export type OrderWithRelations = {
  id: string;
  userId: string;
  merchantId: string;
  addressId: string | null;
  status: string | null;
  subtotal: { toString(): string } | null;
  deliveryFee: { toString(): string } | null;
  total: { toString(): string } | null;
  notes: string | null;
  checkoutRef: string | null;
  itemsSnapshot: unknown;
  createdAt: Date;
  orderItems: Array<{
    id: string;
    productId: string;
    productName: string;
    quantity: number;
    unitPrice: { toString(): string };
    totalPrice: { toString(): string };
  }>;
  merchant: { id: string; name: string };
  user?: {
    id: string;
    fullName: string | null;
    phone: string;
  };
  address?: {
    id: string;
    addressLine: string;
    latitude: { toString(): string };
    longitude: { toString(): string };
  } | null;
};
