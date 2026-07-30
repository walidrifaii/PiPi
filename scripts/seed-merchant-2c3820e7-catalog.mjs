process.env.SEED_CATALOG_FILE ??= "scripts/data/merchant-2c3820e7-catalog.json";
await import("./seed-merchant-catalog.mjs");
