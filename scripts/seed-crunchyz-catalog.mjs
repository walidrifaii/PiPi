process.env.SEED_CATALOG_FILE ??= "scripts/data/crunchyz.json";
await import("./seed-merchant-catalog.mjs");
