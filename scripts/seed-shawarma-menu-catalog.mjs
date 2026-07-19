process.env.SEED_CATALOG_FILE ??= "scripts/data/shawarma-menu.json";
await import("./seed-merchant-catalog.mjs");
