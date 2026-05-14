/**
 * GeoJSON Polygon helpers: exterior ring + holes, WGS84 [lng, lat] per position.
 * @see https://datatracker.ietf.org/doc/html/rfc7946#section-3.1.6
 */

export type PolygonRings = {
  /** Exterior ring (counter-clockwise per RFC; algorithm does not require winding). */
  exterior: [number, number][];
  /** Interior rings (holes). */
  holes: [number, number][][];
};

/**
 * Ray-casting: true if (lng, lat) lies inside the closed ring (first point may duplicate last).
 */
export function pointInRing(
  lng: number,
  lat: number,
  ring: [number, number][],
): boolean {
  if (ring.length < 3) {
    return false;
  }
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    const denom = yj - yi;
    if (denom === 0) {
      continue;
    }
    const intersect =
      yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / denom + xi;
    if (intersect) {
      inside = !inside;
    }
  }
  return inside;
}

export function pointInPolygonRings(
  lng: number,
  lat: number,
  poly: PolygonRings,
): boolean {
  if (!pointInRing(lng, lat, poly.exterior)) {
    return false;
  }
  for (const hole of poly.holes) {
    if (pointInRing(lng, lat, hole)) {
      return false;
    }
  }
  return true;
}

function asLngLatPair(v: unknown): [number, number] | null {
  if (!Array.isArray(v) || v.length < 2) {
    return null;
  }
  const lng = Number(v[0]);
  const lat = Number(v[1]);
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
    return null;
  }
  return [lng, lat];
}

function normalizeRing(raw: unknown): [number, number][] | null {
  if (!Array.isArray(raw) || raw.length < 3) {
    return null;
  }
  const ring: [number, number][] = [];
  for (const p of raw) {
    const pair = asLngLatPair(p);
    if (!pair) {
      return null;
    }
    ring.push(pair);
  }
  return ring;
}

/**
 * Accepts GeoJSON Polygon geometry, Feature(Polygon), or FeatureCollection (first Polygon).
 */
export function parsePolygonRingsFromGeoJson(
  raw: unknown,
): PolygonRings | null {
  if (raw === null || typeof raw !== 'object') {
    return null;
  }
  const o = raw as Record<string, unknown>;

  if (o.type === 'FeatureCollection' && Array.isArray(o.features)) {
    for (const f of o.features) {
      const parsed = parsePolygonRingsFromGeoJson(f);
      if (parsed) {
        return parsed;
      }
    }
    return null;
  }

  if (o.type === 'Feature' && o.geometry && typeof o.geometry === 'object') {
    return parsePolygonRingsFromGeoJson(o.geometry);
  }

  if (o.type === 'MultiPolygon' && Array.isArray(o.coordinates)) {
    const firstPoly = o.coordinates[0];
    if (Array.isArray(firstPoly)) {
      return parsePolygonRingsFromGeoJson({
        type: 'Polygon',
        coordinates: firstPoly,
      });
    }
    return null;
  }

  if (o.type !== 'Polygon' || !Array.isArray(o.coordinates)) {
    return null;
  }

  const rings = o.coordinates as unknown[];
  if (rings.length === 0 || !Array.isArray(rings[0])) {
    return null;
  }

  const exterior = normalizeRing(rings[0]);
  if (!exterior) {
    return null;
  }

  const holes: [number, number][][] = [];
  for (let i = 1; i < rings.length; i++) {
    const hole = normalizeRing(rings[i]);
    if (hole) {
      holes.push(hole);
    }
  }

  return { exterior, holes };
}
