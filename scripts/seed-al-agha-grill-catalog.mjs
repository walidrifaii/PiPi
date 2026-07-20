process.env.SEED_CATALOG_FILE ??= "scripts/data/al-agha-grill.json";
await import("./seed-merchant-catalog.mjs");
