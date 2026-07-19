process.env.SEED_CATALOG_FILE ??= "scripts/data/manqoushe.json";
await import("./seed-merchant-catalog.mjs");
