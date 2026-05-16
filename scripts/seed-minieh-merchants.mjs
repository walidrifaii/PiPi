/**
 * Seeds demo restaurants inside a GeoJSON polygon (Minieh area).
 *
 * Usage (from repo root):
 *   node scripts/seed-minieh-merchants.mjs
 *
 * Env:
 *   DATABASE_PUBLIC_URL or DATABASE_URL — required
 *   SEED_CITY_CODE — default MINIEH
 *   SEED_PASSWORD — default Athar123!
 */
import "dotenv/config";
import bcrypt from "bcrypt";
import crypto from "crypto";
import pg from "pg";

const POLYGON = {
  type: "Polygon",
  coordinates: [
    [
      [35.883544, 34.463211],
      [35.902602, 34.448626],
      [35.923548, 34.448909],
      [35.944446, 34.455969],
      [35.974149, 34.448889],
      [35.975007, 34.468713],
      [35.954748, 34.488673],
      [35.970274, 34.497348],
      [35.944348, 34.502685],
      [35.883544, 34.463211],
    ],
  ],
};

const MERCHANT_NAMES = [
  "Abou Shaker",
  "Gega Bite",
  "Crushies",
  "Hayat Donar",
  "Poul Dor",
  "Malek Tawook",
  "Aminos",
  "Papay",
  "Balha",
  "Snack Corner",
];

/** Created OPEN; set CLOSED after insert (is_active = false → status CLOSED in API). */
const CLOSED_MERCHANT_NAMES = new Set(["Papay", "Snack Corner"]);

const RESTAURANT_TYPE_ID = "a0000000-0000-4000-8000-000000000002";
const PLACEHOLDER_IMAGE =
  "https://res.cloudinary.com/dlbvvnblt/image/upload/v1778668444/athar/merchants/logo/dre9w5ihxevqtlta2an1.jpg";
const PLACEHOLDER_COVER =
  "https://res.cloudinary.com/dlbvvnblt/image/upload/v1778668444/athar/merchants/cover/on3wx0dgqcefrcnfjbpw.jpg";

const exterior = POLYGON.coordinates[0];

function pointInRing(lng, lat, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    const denom = yj - yi;
    if (denom === 0) continue;
    const intersect =
      yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / denom + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function ringBBox(ring) {
  let minLng = ring[0][0];
  let maxLng = ring[0][0];
  let minLat = ring[0][1];
  let maxLat = ring[0][1];
  for (let i = 1; i < ring.length; i++) {
    const [lng, lat] = ring[i];
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }
  return { minLng, maxLng, minLat, maxLat };
}

/** Spread N points inside the polygon (deterministic per index). */
function samplePointsInPolygon(count) {
  const bbox = ringBBox(exterior);
  const ringOpen = exterior.slice(0, -1);
  let cx = 0;
  let cy = 0;
  for (const [lng, lat] of ringOpen) {
    cx += lng;
    cy += lat;
  }
  cx /= ringOpen.length;
  cy /= ringOpen.length;

  const points = [];
  for (let i = 0; i < count; i++) {
    const vtx = ringOpen[i % ringOpen.length];
    const t = 0.35 + (i % 5) * 0.1;
    let lng = cx + (vtx[0] - cx) * t;
    let lat = cy + (vtx[1] - cy) * t;

    if (!pointInRing(lng, lat, exterior)) {
      for (let attempt = 0; attempt < 500; attempt++) {
        lng = bbox.minLng + Math.random() * (bbox.maxLng - bbox.minLng);
        lat = bbox.minLat + Math.random() * (bbox.maxLat - bbox.minLat);
        if (pointInRing(lng, lat, exterior)) break;
      }
    }

    if (!pointInRing(lng, lat, exterior)) {
      throw new Error(`Could not place point ${i + 1} inside polygon`);
    }

    points.push({
      longitude: Number(lng.toFixed(7)),
      latitude: Number(lat.toFixed(7)),
    });
  }
  return points;
}

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

const cityCode = (process.env.SEED_CITY_CODE ?? "MINIEH").trim().toUpperCase();
const seedPassword = process.env.SEED_PASSWORD ?? "Athar123!";

const url =
  process.env.DATABASE_PUBLIC_URL?.trim() || process.env.DATABASE_URL;
if (!url) {
  console.error("Missing DATABASE_URL or DATABASE_PUBLIC_URL");
  process.exit(1);
}

const client = new pg.Client({ connectionString: url });
await client.connect();

const passwordHash = await bcrypt.hash(seedPassword, 10);
const coords = samplePointsInPolygon(MERCHANT_NAMES.length);
const created = [];
const skipped = [];

try {
  await client.query("BEGIN");

  await client.query(
    `INSERT INTO service_areas (id, code, name, boundary_geo_json, is_active, created_at, updated_at)
     VALUES ($1, $2, $3, $4::jsonb, true, NOW(), NOW())
     ON CONFLICT (code) DO UPDATE SET
       boundary_geo_json = EXCLUDED.boundary_geo_json,
       name = COALESCE(service_areas.name, EXCLUDED.name),
       is_active = true,
       updated_at = NOW()`,
    [
      crypto.randomUUID(),
      cityCode,
      "Minieh",
      JSON.stringify(POLYGON),
    ],
  );
  console.log(`Service area ${cityCode}: polygon updated.`);

  for (let i = 0; i < MERCHANT_NAMES.length; i++) {
    const name = MERCHANT_NAMES[i];
    const slug = slugify(name);
    const email = `seed.${slug}.${cityCode.toLowerCase()}@athar.demo`;
    const phone = `+96170${String(100000 + i).slice(-6)}`;
    const { latitude, longitude } = coords[i];

    const existing = await client.query(
      `SELECT id FROM merchants WHERE name = $1 OR email = $2 OR phone = $3 LIMIT 1`,
      [name, email, phone],
    );
    if (existing.rowCount > 0) {
      skipped.push({ name, reason: "already exists" });
      continue;
    }

    const id = crypto.randomUUID();
    const isActive = !CLOSED_MERCHANT_NAMES.has(name);
    await client.query(
      `INSERT INTO merchants (
        id, name, merchant_type_id, email, phone, password_hash,
        image_url, cover_image_url, city_code, latitude, longitude,
        is_active, use_working_hours, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10, $11,
        $12, false, NOW(), NOW()
      )`,
      [
        id,
        name,
        RESTAURANT_TYPE_ID,
        email,
        phone,
        passwordHash,
        PLACEHOLDER_IMAGE,
        PLACEHOLDER_COVER,
        cityCode,
        latitude,
        longitude,
        isActive,
      ],
    );

    created.push({
      id,
      name,
      email,
      phone,
      latitude,
      longitude,
      status: isActive ? "OPEN" : "CLOSED",
    });
  }

  await client.query("COMMIT");

  console.log("\nCreated merchants:", created.length);
  for (const m of created) {
    console.log(
      `  - ${m.name} [${m.status}] | ${m.email} | lat ${m.latitude}, lng ${m.longitude}`,
    );
  }
  if (skipped.length) {
    console.log("\nSkipped:", skipped.length);
    for (const s of skipped) {
      console.log(`  - ${s.name}: ${s.reason}`);
    }
  }
  console.log(`\nLogin password for new accounts: ${seedPassword}`);
} catch (err) {
  await client.query("ROLLBACK");
  console.error(err);
  process.exit(1);
} finally {
  await client.end();
}
