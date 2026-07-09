process.env.SEED_CATALOG_FILE ??= "scripts/data/hayat-donur.json";
await import("./seed-merchant-catalog.mjs");
