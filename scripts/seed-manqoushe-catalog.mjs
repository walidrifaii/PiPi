/**
 * Seed Manqoushe bakery catalog for merchant c8c82cf1-b87b-4ab9-bf18-1bea26870c7e.
 *
 * Usage (from athar/):
 *   node scripts/seed-manqoushe-catalog.mjs
 *   SEED_REPLACE_CATALOG=1 node scripts/seed-manqoushe-catalog.mjs
 */
process.env.SEED_CATALOG_FILE ??= "scripts/data/manqoushe.json";
process.env.SEED_MERCHANT_ID ??= "c8c82cf1-b87b-4ab9-bf18-1bea26870c7e";
await import("./seed-merchant-catalog.mjs");
