/**
 * Seed supermarket catalog for merchant a8d87c1e-da2e-4739-91e1-f8c4dc2e3da9.
 *
 * Source: scripts/data/merchant-a8d87c1e-products.json
 *   (same categories/items as 17423af2, prices at +10% markup)
 *
 * Usage (from PiPi/):
 *   node scripts/seed-merchant-a8d87c1e-catalog.mjs
 *   SEED_REPLACE_CATALOG=1 node scripts/seed-merchant-a8d87c1e-catalog.mjs
 */
import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const merchantId = "a8d87c1e-da2e-4739-91e1-f8c4dc2e3da9";
const sourceFile = path.join(__dirname, "data", "merchant-a8d87c1e-products.json");
const catalogFile = path.join(__dirname, "data", "merchant-a8d87c1e-catalog.json");

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

process.env.SEED_CATALOG_FILE ??= "scripts/data/merchant-a8d87c1e-catalog.json";
process.env.SEED_MERCHANT_ID ??= merchantId;
process.env.SEED_REPLACE_CATALOG ??= "1";
await import("./seed-merchant-catalog.mjs");
