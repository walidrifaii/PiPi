process.env.SEED_CATALOG_FILE ??= "scripts/data/tia-murai.json";
process.env.SEED_MERCHANT_ID ??= "abfed4d3-25ea-427f-b625-627d2b2b080d";
await import("./seed-merchant-catalog.mjs");
