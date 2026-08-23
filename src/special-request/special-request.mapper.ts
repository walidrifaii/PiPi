import { computeDriverEarningsFromDeliveryFee } from '../platform-settings/driver-delivery-share';
import {
  normalizeSpecialRequestStatus,
  type SpecialRequestStatus,
} from './special-request.constants';

export type SpecialRequestFeeSnapshot = {
  buyFee: number;
  serviceFee: number;
  deliveryFee: number;
  total: number;
  etaMinMinutes: number | null;
  etaMaxMinutes: number | null;
  timezone: string;
};

export type SpecialRequestLocationView = {
  addressLine: string;
  latitude: number;
  longitude: number;
  addressId: string | null;
};

export type SpecialRequestView = {
  id: string;
  requestRef: string | null;
  status: SpecialRequestStatus;
  storeName: string;
  itemName: string;
  productImageUrl: string;
  buyFee: number;
  serviceFee: number;
  deliveryFee: number;
  total: number;
  from: SpecialRequestLocationView;
  to: SpecialRequestLocationView;
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
  driverEarnings?: number;
};

type MoneyLike = { toString(): string } | number | string;

function toNumber(value: MoneyLike): number {
  return Number(value);
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function mapSpecialRequest(row: {
  id: string;
  requestRef: string | null;
  status: string | null;
  storeName: string;
  itemName: string;
  productImageUrl: string;
  serviceFee: MoneyLike;
  deliveryFee: MoneyLike;
  total: MoneyLike;
  fromAddressLine: string;
  fromLatitude: MoneyLike;
  fromLongitude: MoneyLike;
  fromAddressId: string | null;
  toAddressLine: string;
  toLatitude: MoneyLike;
  toLongitude: MoneyLike;
  toAddressId: string | null;
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
}): SpecialRequestView {
  const serviceFee = roundMoney(toNumber(row.serviceFee));
  return {
    id: row.id,
    requestRef: row.requestRef,
    status: normalizeSpecialRequestStatus(row.status),
    storeName: row.storeName,
    itemName: row.itemName,
    productImageUrl: row.productImageUrl,
    buyFee: serviceFee,
    serviceFee,
    deliveryFee: roundMoney(toNumber(row.deliveryFee)),
    total: roundMoney(toNumber(row.total)),
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
  };
}

export function withDriverEarnings(
  view: SpecialRequestView,
  sharePercent: number,
): SpecialRequestView {
  return {
    ...view,
    driverEarnings: computeDriverEarningsFromDeliveryFee(
      view.serviceFee,
      sharePercent,
    ),
  };
}
