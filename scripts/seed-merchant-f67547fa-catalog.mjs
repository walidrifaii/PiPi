/**
 * Seed Fresh & Desserts catalog for merchant f67547fa-e5b8-405d-9e93-67d0c71d34a8 only.
 *
 * Source: scripts/data/merchant-f67547fa-fresh-desserts-menu.json
 * Prices: same as source menu (no markup).
 *
 * Usage (from PiPi/):
 *   node scripts/seed-merchant-f67547fa-catalog.mjs
 *   SEED_REPLACE_CATALOG=0 node scripts/seed-merchant-f67547fa-catalog.mjs
 */
import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const merchantId = "f67547fa-e5b8-405d-9e93-67d0c71d34a8";
const sourceFile = path.join(
  __dirname,
  "data",
  "merchant-f67547fa-fresh-desserts-menu.json",
);
const catalogFile = path.join(
  __dirname,
  "data",
  "merchant-f67547fa-catalog.json",
);

if (!fs.existsSync(sourceFile)) {
  console.error(`Missing source file: ${sourceFile}`);
  process.exit(1);
}

const transform = spawnSync(
  process.execPath,
  [
    path.join(__dirname, "transform-ado-menu-catalog.mjs"),
    sourceFile,
    catalogFile,
    merchantId,
    "1",
  ],
  { stdio: "inherit", cwd: path.join(__dirname, "..") },
);
if (transform.status !== 0) {
  process.exit(transform.status ?? 1);
}

process.env.SEED_CATALOG_FILE ??= "scripts/data/merchant-f67547fa-catalog.json";
process.env.SEED_MERCHANT_ID ??= merchantId;
process.env.SEED_REPLACE_CATALOG ??= "1";
await import("./seed-merchant-catalog.mjs");
