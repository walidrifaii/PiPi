/**
 * Recomputes Prisma migration checksums from disk and updates `_prisma_migrations`.
 * Run when `migrate dev` says a migration was "modified after it was applied".
 *
 * Usage: node scripts/repair-migration-checksum.mjs [migration_folder_name]
 * Example: node scripts/repair-migration-checksum.mjs 20260413120000_local_merchant_catalog
 * Omit the argument to repair all migrations.
 */
import "dotenv/config";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import pg from "pg";

const migrationsDir = path.resolve("prisma/migrations");
const only = process.argv[2];

function checksumOfMigrationFile(sqlPath) {
  const buf = fs.readFileSync(sqlPath);
  return crypto.createHash("sha256").update(buf).digest("hex");
}

const url =
  process.env.DATABASE_PUBLIC_URL?.trim() || process.env.DATABASE_URL;
if (!url) {
  console.error("Missing DATABASE_URL or DATABASE_PUBLIC_URL");
  process.exit(1);
}

const client = new pg.Client({ connectionString: url });
await client.connect();

try {
  const dirs = fs
    .readdirSync(migrationsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .filter((name) => /^\d{14}_/.test(name))
    .sort();

  for (const name of dirs) {
    if (only && name !== only) continue;
    const sqlPath = path.join(migrationsDir, name, "migration.sql");
    if (!fs.existsSync(sqlPath)) continue;
    const checksum = checksumOfMigrationFile(sqlPath);
    const r = await client.query(
      `UPDATE "_prisma_migrations" SET "checksum" = $1 WHERE "migration_name" = $2`,
      [checksum, name],
    );
    if (r.rowCount > 0) {
      console.log(`Updated checksum for ${name} -> ${checksum}`);
    }
  }
} finally {
  await client.end();
}
