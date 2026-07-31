process.env.SEED_CATALOG_FILE ??= "scripts/data/merchant-6afdd023-catalog.json";
await import("./seed-merchant-catalog.mjs");
