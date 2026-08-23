import { computeDriverEarningsFromDeliveryFee } from '../platform-settings/driver-delivery-share';
import type { DeliveryFeeBreakdown } from '../common/delivery-fee';
import { normalizePickupStatus, type PickupMethod, type PickupStatus } from './pickup.constants';

export type PickupFeeSnapshot = {
  serviceFee: number;
  deliveryFee: number;
  total: number;
  distanceKm: number;
  deliveryFeeBreakdown: DeliveryFeeBreakdown & { configId: string | null };
  etaMinMinutes: number | null;
  etaMaxMinutes: number | null;
  timezone: string;
};

export type PickupLocationView = {
  addressLine: string;
  latitude: number;
  longitude: number;
  addressId: string | null;
};

export type PickupOrderView = {
  id: string;
  pickupRef: string | null;
  method: PickupMethod;
  status: PickupStatus;
  description: string;
  declaredValue: number;
  serviceFee: number;
  deliveryFee: number;
  total: number;
  distanceKm: number;
  from: PickupLocationView;
  to: PickupLocationView;
  scheduledAt: string | null;
  etaMinMinutes: number | null;
  etaMaxMinutes: number | null;
  createdAt: string;
  updatedAt: string;
  driver: {
    id: string;
    fullName: string | null;
    phone: string;
    vehicleType: string | null;
  } | null;
  customer?: {
    id: string;
    fullName: string | null;
    phone: string;
  };
  recipient: {
    fullName: string | null;
    phone: string | null;
  };
  driverEarnings?: number;
};

type MoneyLike = { toString(): string } | number | string;

function toNumber(value: MoneyLike): number {
  return Number(value);
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function mapPickupOrder(row: {
  id: string;
  pickupRef: string | null;
  method: string;
  status: string | null;
  description: string;
  declaredValue: MoneyLike;
  serviceFee: MoneyLike;
  deliveryFee: MoneyLike;
  total: MoneyLike;
  distanceKm: MoneyLike;
  fromAddressLine: string;
  fromLatitude: MoneyLike;
  fromLongitude: MoneyLike;
  fromAddressId: string | null;
  toAddressLine: string;
  toLatitude: MoneyLike;
  toLongitude: MoneyLike;
  toAddressId: string | null;
  recipientFullName: string | null;
  recipientPhone: string | null;
  scheduledAt: Date | null;
  etaMinMinutes: number | null;
  etaMaxMinutes: number | null;
  createdAt: Date;
  updatedAt: Date;
  driver?: {
    id: string;
    fullName: string | null;
    phone: string;
    vehicleType: string | null;
  } | null;
  user?: {
    id: string;
    fullName: string | null;
    phone: string;
  };
}): PickupOrderView {
  return {
    id: row.id,
    pickupRef: row.pickupRef,
    method: row.method === 'SCHEDULED' ? 'SCHEDULED' : 'NOW',
    status: normalizePickupStatus(row.status),
    description: row.description,
    declaredValue: roundMoney(toNumber(row.declaredValue)),
    serviceFee: roundMoney(toNumber(row.serviceFee)),
    deliveryFee: roundMoney(toNumber(row.deliveryFee)),
    total: roundMoney(toNumber(row.total)),
    distanceKm: Math.round(toNumber(row.distanceKm) * 1000) / 1000,
    from: {
      addressLine: row.fromAddressLine,
      latitude: toNumber(row.fromLatitude),
      longitude: toNumber(row.fromLongitude),
      addressId: row.fromAddressId,
    },
    to: {
      addressLine: row.toAddressLine,
      latitude: toNumber(row.toLatitude),
      longitude: toNumber(row.toLongitude),
      addressId: row.toAddressId,
    },
    scheduledAt: row.scheduledAt ? row.scheduledAt.toISOString() : null,
    etaMinMinutes: row.etaMinMinutes,
    etaMaxMinutes: row.etaMaxMinutes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    driver: row.driver
      ? {
          id: row.driver.id,
          fullName: row.driver.fullName,
          phone: row.driver.phone,
          vehicleType: row.driver.vehicleType,
        }
      : null,
    ...(row.user
      ? {
          customer: {
            id: row.user.id,
            fullName: row.user.fullName,
            phone: row.user.phone,
          },
        }
      : {}),
    recipient: {
      fullName: row.recipientFullName,
      phone: row.recipientPhone,
    },
  };
}

export function withDriverEarnings(
  view: PickupOrderView,
  sharePercent: number,
): PickupOrderView {
  return {
    ...view,
    driverEarnings: computeDriverEarningsFromDeliveryFee(
      view.deliveryFee,
      sharePercent,
    ),
  };
}
