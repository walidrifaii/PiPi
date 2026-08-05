/**
 * Deletes all products and categories for one merchant.
 *
 * Usage (from PiPi/):
 *   CONFIRM_DELETE_MERCHANT_CATALOG=yes MERCHANT_ID=a8d87c1e-da2e-4739-91e1-f8c4dc2e3da9 node scripts/delete-merchant-catalog.mjs
 *
 * Env:
 *   DATABASE_PUBLIC_URL or DATABASE_URL — required
 *   MERCHANT_ID — merchant UUID (required)
 *   CONFIRM_DELETE_MERCHANT_CATALOG=yes — required safety flag
 */
import "dotenv/config";
import pg from "pg";

const url =
  process.env.DATABASE_PUBLIC_URL?.trim() || process.env.DATABASE_URL;
const merchantId = process.env.MERCHANT_ID?.trim();

if (!url) {
  console.error("Missing DATABASE_URL or DATABASE_PUBLIC_URL");
  process.exit(1);
}

if (!merchantId) {
  console.error("Missing MERCHANT_ID");
  process.exit(1);
}

if (process.env.CONFIRM_DELETE_MERCHANT_CATALOG !== "yes") {
  console.error(
    "Refusing to run. Set CONFIRM_DELETE_MERCHANT_CATALOG=yes to delete this merchant catalog.",
  );
  process.exit(1);
}

const client = new pg.Client({ connectionString: url });
await client.connect();

try {
  const merchantRes = await client.query(
    `SELECT id, name FROM merchants WHERE id = $1 LIMIT 1`,
    [merchantId],
  );
  if (merchantRes.rowCount === 0) {
    throw new Error(`Merchant not found for id ${merchantId}`);
  }

  const merchantName = merchantRes.rows[0].name;

  const beforeProducts = await client.query(
    `SELECT COUNT(*)::int AS n
     FROM products p
     JOIN merchant_categories c ON c.id = p.category_id
     WHERE c.merchant_id = $1`,
    [merchantId],
  );
  const beforeCategories = await client.query(
    `SELECT COUNT(*)::int AS n FROM merchant_categories WHERE merchant_id = $1`,
    [merchantId],
  );

  const productCount = beforeProducts.rows[0].n;
  const categoryCount = beforeCategories.rows[0].n;

  console.log(`Merchant: ${merchantName} (${merchantId})`);
  console.log(`Products: ${productCount}, categories: ${categoryCount}`);

  if (productCount === 0 && categoryCount === 0) {
    console.log("Nothing to delete.");
    return;
  }

  await client.query("BEGIN");

  const deletedProducts = await client.query(
    `DELETE FROM products
     WHERE category_id IN (
       SELECT id FROM merchant_categories WHERE merchant_id = $1
     )`,
    [merchantId],
  );
  const deletedCategories = await client.query(
    `DELETE FROM merchant_categories WHERE merchant_id = $1`,
    [merchantId],
  );

  await client.query("COMMIT");

  console.log(
    `Deleted ${deletedProducts.rowCount} products and ${deletedCategories.rowCount} categories.`,
  );
} catch (err) {
  await client.query("ROLLBACK");
  console.error("Delete failed:", err.message);
  process.exit(1);
} finally {
  await client.end();
}
