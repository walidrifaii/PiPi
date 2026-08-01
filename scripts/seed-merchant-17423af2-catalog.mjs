/**
 * Seed supermarket catalog for merchant 17423af2-31c3-4b11-91f3-e0ee7e095200.
 *
 * Source: scripts/data/merchant-17423af2-products.json
 *   [{ name: "<category>", items: [{ name, price }] }]
 *
 * Usage (from PiPi/):
 *   node scripts/seed-merchant-17423af2-catalog.mjs
 *   SEED_REPLACE_CATALOG=1 node scripts/seed-merchant-17423af2-catalog.mjs
 */
import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const merchantId = "17423af2-31c3-4b11-91f3-e0ee7e095200";
const sourceFile = path.join(__dirname, "data", "merchant-17423af2-products.json");
const catalogFile = path.join(__dirname, "data", "merchant-17423af2-catalog.json");

if (!fs.existsSync(sourceFile)) {
  console.error(`Missing source file: ${sourceFile}`);
  process.exit(1);
}

const transform = spawnSync(
  process.execPath,
  [
    path.join(__dirname, "transform-nested-products-catalog.mjs"),
    sourceFile,
    catalogFile,
    merchantId,
  ],
  { stdio: "inherit", cwd: path.join(__dirname, "..") },
);
if (transform.status !== 0) {
  process.exit(transform.status ?? 1);
}

process.env.SEED_CATALOG_FILE ??= "scripts/data/merchant-17423af2-catalog.json";
process.env.SEED_MERCHANT_ID ??= merchantId;
process.env.SEED_REPLACE_CATALOG ??= "1";
await import("./seed-merchant-catalog.mjs");
