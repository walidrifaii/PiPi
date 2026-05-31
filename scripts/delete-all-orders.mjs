/**
 * Deletes every row from order_items and orders.
 *
 * Usage (from athar/):
 *   CONFIRM_DELETE_ALL_ORDERS=yes node scripts/delete-all-orders.mjs
 *
 * Env:
 *   DATABASE_PUBLIC_URL or DATABASE_URL — required
 *   CONFIRM_DELETE_ALL_ORDERS=yes       — required safety flag
 */
import "dotenv/config";
import pg from "pg";

const url =
  process.env.DATABASE_PUBLIC_URL?.trim() || process.env.DATABASE_URL;

if (!url) {
  console.error("Missing DATABASE_URL or DATABASE_PUBLIC_URL");
  process.exit(1);
}

if (process.env.CONFIRM_DELETE_ALL_ORDERS !== "yes") {
  console.error(
    "Refusing to run. Set CONFIRM_DELETE_ALL_ORDERS=yes to delete all orders.",
  );
  process.exit(1);
}

const client = new pg.Client({ connectionString: url });
await client.connect();

try {
  const beforeOrders = await client.query(`SELECT COUNT(*)::int AS n FROM orders`);
  const beforeItems = await client.query(
    `SELECT COUNT(*)::int AS n FROM order_items`,
  );

  console.log(`Orders: ${beforeOrders.rows[0].n}, order items: ${beforeItems.rows[0].n}`);

  await client.query("BEGIN");
  // order_items also cascade when orders are deleted, but deleting items first is explicit.
  const deletedItems = await client.query(`DELETE FROM order_items`);
  const deletedOrders = await client.query(`DELETE FROM orders`);
  await client.query("COMMIT");

  console.log(
    `Deleted ${deletedOrders.rowCount} orders and ${deletedItems.rowCount} order items.`,
  );
  console.log(
    "Note: Firebase/Firestore order chat, tracking, and call data are not removed by this script.",
  );
} catch (err) {
  await client.query("ROLLBACK");
  console.error("Delete failed:", err.message);
  process.exit(1);
} finally {
  await client.end();
}
