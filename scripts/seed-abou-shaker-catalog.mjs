process.env.SEED_CATALOG_FILE ??= "scripts/data/abou-shaker.json";
await import("./seed-merchant-catalog.mjs");
