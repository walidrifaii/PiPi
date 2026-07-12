/**
 * Seed menu_separated catalog for merchant 1e6e8630-ac59-4b70-93dc-d1c681fbee3d.
 *
 * Maps JSON fields -> DB:
 *   categories[].name_en  -> merchant_categories.name
 *   categories[].name_ar  -> merchant_categories.name_ar
 *   items[].name_en       -> products.name
 *   items[].name_ar       -> products.name_ar
 *   items[].price         -> products.price
 *   items[].category_name_en -> products.category_id (via category lookup)
 *
 * Category/product ids are generated as new UUIDs (not taken from the source file).
 *
 * Usage (from athar/):
 *   node scripts/seed-menu-separated-catalog.mjs
 *   SEED_REPLACE_CATALOG=1 node scripts/seed-menu-separated-catalog.mjs
 */
process.env.SEED_CATALOG_FILE ??= "scripts/data/menu-separated.json";
process.env.SEED_MERCHANT_ID ??= "1e6e8630-ac59-4b70-93dc-d1c681fbee3d";
await import("./seed-merchant-catalog.mjs");
