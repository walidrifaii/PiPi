/** Set named seed merchants to CLOSED (is_active = false). */
import "dotenv/config";
import pg from "pg";

const CLOSED_NAMES = (process.env.SEED_CLOSED_NAMES ?? "Papay,Snack Corner")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const url =
  process.env.DATABASE_PUBLIC_URL?.trim() || process.env.DATABASE_URL;
if (!url) {
  console.error("Missing DATABASE_URL or DATABASE_PUBLIC_URL");
  process.exit(1);
}

const client = new pg.Client({ connectionString: url });
await client.connect();

const r = await client.query(
  `UPDATE merchants
   SET is_active = false, updated_at = NOW()
   WHERE name = ANY($1::text[])
     AND email LIKE 'seed.%@athar.demo'
   RETURNING name, is_active`,
  [CLOSED_NAMES],
);

console.log("Closed merchants:", r.rowCount);
for (const row of r.rows) {
  console.log(`  - ${row.name} (is_active=${row.is_active})`);
}

await client.end();
