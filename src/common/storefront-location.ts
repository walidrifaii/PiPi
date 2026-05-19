import { BadRequestException } from '@nestjs/common';
import {
  exteriorRingBoundingBox,
  pointInPolygonRings,
  pointOutsideExteriorBBox,
  type PolygonRings,
} from './geojson-polygon';

export function parseRequiredLatLng(
  latRaw?: string,
  lngRaw?: string,
): { lat: number; lng: number } {
  const latStr = latRaw?.trim() ?? '';
  const lngStr = lngRaw?.trim() ?? '';
  if (!latStr || !lngStr) {
    throw new BadRequestException('lat and lng are required');
  }
  const lat = Number(latStr);
  const lng = Number(lngStr);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new BadRequestException('lat and lng must be valid numbers');
  }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    throw new BadRequestException('lat or lng out of valid range');
  }
  return { lat, lng };
}

export type StorefrontSearchType = 'merchant' | 'product';

export function parseStorefrontSearchType(raw?: string): StorefrontSearchType {
  const normalized = raw?.trim().toLowerCase() ?? '';
  if (normalized === 'merchant' || normalized === 'product') {
    return normalized;
  }
  throw new BadRequestException(
    'type is required and must be merchant or product',
  );
}

export function filterRowsWithCoordinatesInBoundary<
  T extends { latitude: unknown; longitude: unknown },
>(
  rows: T[],
  boundary: PolygonRings,
  toNumber: (value: unknown) => number | null,
): T[] {
  const bbox = exteriorRingBoundingBox(boundary.exterior);
  const kept: T[] = [];
  for (const row of rows) {
    const mLat = toNumber(row.latitude);
    const mLng = toNumber(row.longitude);
    if (mLat === null || mLng === null) {
      continue;
    }
    if (bbox !== null && pointOutsideExteriorBBox(mLng, mLat, bbox)) {
      continue;
    }
    if (!pointInPolygonRings(mLng, mLat, boundary)) {
      continue;
    }
    kept.push(row);
  }
  return kept;
}
