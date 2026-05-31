import type { SelectedOptionSnapshot } from '../merchant/product-option.types';

export type OrderItemsSnapshot = {
  merchantName: string;
  latitude: number;
  longitude: number;
  distanceKm: number;
  deliveryTimeMinutes: number;
  /** Super-admin store promo % applied at checkout (null when none). */
  merchantOfferPercent?: number | null;
  /** Server-computed customer subtotal (what the user pays for items). */
  customerSubtotal?: number;
  /** Server-computed customer order total (items + delivery). */
  customerTotal?: number;
  /** Server-computed merchant-facing subtotal (no store promo). */
  merchantSubtotal?: number;
  /** Server-computed merchant-facing total (merchant subtotal + delivery). */
  merchantTotal?: number;
  deliveryFee?: number;
  items: Array<{
    productId: string;
    productName: string;
    quantity: number;
    listPrice: number;
    /** Customer-facing sale price (includes merchant promo when active). */
    discountPrice: number | null;
    /** Product-only sale price (excludes merchant promo). */
    productDiscountPrice?: number | null;
    unitPrice: number;
    totalPrice: number;
    /** Unit price shown to the merchant (no merchant promo). */
    merchantUnitPrice?: number;
    /** Line total shown to the merchant (no merchant promo). */
    merchantTotalPrice?: number;
    message: string | null;
    selectedOptions?: SelectedOptionSnapshot[];
  }>;
};

export type OrderDetailAudience = 'customer' | 'merchant' | 'admin';

export type OrderWithRelations = {
  id: string;
  userId: string;
  merchantId: string;
  addressId: string | null;
  driverId: string | null;
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
  merchant: {
    id: string;
    name: string;
    latitude?: { toString(): string } | null;
    longitude?: { toString(): string } | null;
  };
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
  driver?: {
    id: string;
    fullName: string | null;
    phone: string;
    vehicleType: string | null;
  } | null;
};
