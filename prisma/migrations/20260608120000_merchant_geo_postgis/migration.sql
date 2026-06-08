-- Pure PostgreSQL geo helpers (no PostGIS) for merchant storefront listing.
-- Works on Railway Postgres where PostGIS extension is unavailable.

CREATE OR REPLACE FUNCTION haversine_km(
  lat1 double precision,
  lng1 double precision,
  lat2 double precision,
  lng2 double precision
) RETURNS double precision
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT 6371.0 * 2.0 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2.0), 2.0) +
    cos(radians(lat1)) * cos(radians(lat2)) *
    power(sin(radians(lng2 - lng1) / 2.0), 2.0)
  ));
$$;

CREATE OR REPLACE FUNCTION geojson_exterior_ring(geo jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  feat jsonb;
  i integer;
BEGIN
  IF geo IS NULL THEN
    RETURN NULL;
  END IF;

  IF geo->>'type' = 'FeatureCollection' AND jsonb_typeof(geo->'features') = 'array' THEN
    FOR i IN 0..(jsonb_array_length(geo->'features') - 1) LOOP
      feat := geojson_exterior_ring(geo->'features'->i);
      IF feat IS NOT NULL THEN
        RETURN feat;
      END IF;
    END LOOP;
    RETURN NULL;
  ELSIF geo->>'type' = 'Feature' THEN
    RETURN geojson_exterior_ring(geo->'geometry');
  ELSIF geo->>'type' = 'MultiPolygon' THEN
    RETURN geo->'coordinates'->0->0;
  ELSIF geo->>'type' = 'Polygon' THEN
    RETURN geo->'coordinates'->0;
  END IF;

  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION point_in_geojson_ring(
  lng double precision,
  lat double precision,
  ring jsonb
) RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  n integer;
  i integer;
  j integer;
  xi double precision;
  yi double precision;
  xj double precision;
  yj double precision;
  denom double precision;
  inside boolean := false;
BEGIN
  IF ring IS NULL OR jsonb_typeof(ring) <> 'array' THEN
    RETURN false;
  END IF;

  n := jsonb_array_length(ring);
  IF n < 3 THEN
    RETURN false;
  END IF;

  j := n - 1;
  FOR i IN 0..(n - 1) LOOP
    xi := (ring->i->>0)::double precision;
    yi := (ring->i->>1)::double precision;
    xj := (ring->j->>0)::double precision;
    yj := (ring->j->>1)::double precision;
    denom := yj - yi;
    IF denom <> 0.0
      AND ((yi > lat) <> (yj > lat))
      AND (lng < ((xj - xi) * (lat - yi) / denom + xi))
    THEN
      inside := NOT inside;
    END IF;
    j := i;
  END LOOP;

  RETURN inside;
END;
$$;

CREATE OR REPLACE FUNCTION point_in_geojson_polygon(
  lng double precision,
  lat double precision,
  geo jsonb
) RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  coords jsonb;
  i integer;
BEGIN
  IF geo IS NULL THEN
    RETURN false;
  END IF;

  IF geo->>'type' = 'FeatureCollection' AND jsonb_typeof(geo->'features') = 'array' THEN
    FOR i IN 0..(jsonb_array_length(geo->'features') - 1) LOOP
      IF point_in_geojson_polygon(lng, lat, geo->'features'->i) THEN
        RETURN true;
      END IF;
    END LOOP;
    RETURN false;
  ELSIF geo->>'type' = 'Feature' THEN
    RETURN point_in_geojson_polygon(lng, lat, geo->'geometry');
  ELSIF geo->>'type' = 'MultiPolygon' THEN
    coords := geo->'coordinates'->0;
    IF NOT point_in_geojson_ring(lng, lat, coords->0) THEN
      RETURN false;
    END IF;
    FOR i IN 1..(jsonb_array_length(coords) - 1) LOOP
      IF point_in_geojson_ring(lng, lat, coords->i) THEN
        RETURN false;
      END IF;
    END LOOP;
    RETURN true;
  ELSIF geo->>'type' = 'Polygon' THEN
    coords := geo->'coordinates';
    IF NOT point_in_geojson_ring(lng, lat, coords->0) THEN
      RETURN false;
    END IF;
    FOR i IN 1..(jsonb_array_length(coords) - 1) LOOP
      IF point_in_geojson_ring(lng, lat, coords->i) THEN
        RETURN false;
      END IF;
    END LOOP;
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION geojson_exterior_area_sq(geo jsonb)
RETURNS double precision
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  ring jsonb;
  n integer;
  m integer;
  i integer;
  j integer;
  xi double precision;
  yi double precision;
  xj double precision;
  yj double precision;
  sum double precision := 0.0;
  closed boolean;
BEGIN
  ring := geojson_exterior_ring(geo);
  IF ring IS NULL OR jsonb_typeof(ring) <> 'array' THEN
    RETURN 'Infinity'::double precision;
  END IF;

  n := jsonb_array_length(ring);
  IF n < 3 THEN
    RETURN 'Infinity'::double precision;
  END IF;

  closed :=
    (ring->0->>0)::double precision = (ring->(n - 1)->>0)::double precision
    AND (ring->0->>1)::double precision = (ring->(n - 1)->>1)::double precision;
  m := CASE WHEN closed THEN n - 1 ELSE n END;
  IF m < 3 THEN
    RETURN 'Infinity'::double precision;
  END IF;

  j := m - 1;
  FOR i IN 0..(m - 1) LOOP
    xi := (ring->i->>0)::double precision;
    yi := (ring->i->>1)::double precision;
    xj := (ring->j->>0)::double precision;
    yj := (ring->j->>1)::double precision;
    sum := sum + (xi * yj - xj * yi);
    j := i;
  END LOOP;

  RETURN abs(sum / 2.0);
END;
$$;

CREATE INDEX IF NOT EXISTS "merchants_city_code_geo_idx"
ON "merchants" ("city_code")
WHERE "latitude" IS NOT NULL AND "longitude" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "service_areas_active_boundary_idx"
ON "service_areas" ("code")
WHERE "is_active" = true AND "boundary_geo_json" IS NOT NULL;
