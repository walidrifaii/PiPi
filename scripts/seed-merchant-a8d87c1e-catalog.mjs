/**
 * Seed ADO CREPE catalog for merchant a8d87c1e-da2e-4739-91e1-f8c4dc2e3da9 only.
 *
 * Source: scripts/data/merchant-a8d87c1e-ado-menu.json
 * Prices: +20% markup on base menu prices and addons.
 *
 * Usage (from PiPi/):
 *   node scripts/seed-merchant-a8d87c1e-catalog.mjs
 *   SEED_REPLACE_CATALOG=0 node scripts/seed-merchant-a8d87c1e-catalog.mjs  # keep existing, update matches
 */
import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const merchantId = "a8d87c1e-da2e-4739-91e1-f8c4dc2e3da9";
const sourceFile = path.join(__dirname, "data", "merchant-a8d87c1e-ado-menu.json");
const catalogFile = path.join(__dirname, "data", "merchant-a8d87c1e-catalog.json");

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
    "1.2",
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
