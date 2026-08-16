/**
 * Apply a live 10% store-wide offer for merchant
 * 17423af2-31c3-4b11-91f3-e0ee7e095200.
 *
 * Usage (from PiPi/):
 *   node scripts/apply-merchant-17423af2-10-percent-offer.mjs
 */
import "dotenv/config";
import pg from "pg";

const merchantId = "17423af2-31c3-4b11-91f3-e0ee7e095200";
const url =
  process.env.DATABASE_PUBLIC_URL?.trim() || process.env.DATABASE_URL;

if (!url) {
  console.error("Missing DATABASE_URL or DATABASE_PUBLIC_URL");
  process.exit(1);
}

const client = new pg.Client({ connectionString: url });
await client.connect();

try {
  const merchant = await client.query(
    `SELECT id, name FROM merchants WHERE id = $1`,
    [merchantId],
  );
  if (merchant.rowCount === 0) {
    throw new Error(`Merchant not found: ${merchantId}`);
  }

  const now = new Date();
  const endsAt = new Date(now);
  endsAt.setFullYear(endsAt.getFullYear() + 1);

  const deactivated = await client.query(
    `UPDATE merchant_offers
     SET is_active = false, updated_at = NOW()
     WHERE merchant_id = $1 AND is_active = true`,
    [merchantId],
  );

  const inserted = await client.query(
    `INSERT INTO merchant_offers (
       id, merchant_id, title, title_ar, discount_percent,
       is_active, starts_at, ends_at, created_at, updated_at
     ) VALUES (
       gen_random_uuid(), $1, $2, $3, 10,
       true, $4, $5, NOW(), NOW()
     )
     RETURNING id, discount_percent, starts_at, ends_at, is_active`,
    [
      merchantId,
      "10% off",
      "خصم 10%",
      now.toISOString(),
      endsAt.toISOString(),
    ],
  );

  const productCount = await client.query(
    `SELECT COUNT(*)::int AS count
     FROM products p
     JOIN merchant_categories c ON c.id = p.category_id
     WHERE c.merchant_id = $1`,
    [merchantId],
  );

  console.log(
    JSON.stringify(
      {
        merchant: merchant.rows[0],
        deactivatedOffers: deactivated.rowCount,
        offer: inserted.rows[0],
        productsAffected: productCount.rows[0].count,
      },
      null,
      2,
    ),
  );
} finally {
  await client.end();
}
