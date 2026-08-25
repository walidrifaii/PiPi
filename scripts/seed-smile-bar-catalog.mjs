process.env.SEED_CATALOG_FILE ??= "scripts/data/smile-bar.json";
process.env.SEED_MERCHANT_ID ??= "43590947-5578-4ce5-b42f-630177051456";
await import("./seed-merchant-catalog.mjs");
