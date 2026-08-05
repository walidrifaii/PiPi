/**
 * Seeds merchant menu categories and products from a catalog JSON file.
 *
 * Field mapping (source JSON -> DB):
 *   category: title -> name, titleAr -> nameAr, displayOrder -> sortOrder
 *   product:  name, name_ar -> nameAr, description, description_ar -> descriptionAr, price
 *   category / categories[0] -> categoryName (ignored: currency, category_ar)
 *
 * Usage (from repo root):
 *   node scripts/seed-merchant-catalog.mjs
 *   SEED_CATALOG_FILE=scripts/data/abou-shaker.json node scripts/seed-merchant-catalog.mjs
 *
 * Env:
 *   DATABASE_PUBLIC_URL or DATABASE_URL — required
 *   SEED_CATALOG_FILE — path to catalog JSON (default: scripts/data/hayat-donur.json)
 *   SEED_MERCHANT_ID — override merchant id from JSON
 *   SEED_REPLACE_CATALOG=1 — delete existing catalog before insert
 */
import "dotenv/config";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataPath = path.resolve(
  process.cwd(),
  process.env.SEED_CATALOG_FILE?.trim() ||
    path.join(__dirname, "data", "hayat-donur.json"),
);

const url =
  process.env.DATABASE_PUBLIC_URL?.trim() || process.env.DATABASE_URL;
if (!url) {
  console.error("Missing DATABASE_URL or DATABASE_PUBLIC_URL");
  process.exit(1);
}

if (!fs.existsSync(dataPath)) {
  console.error(`Catalog file not found: ${dataPath}`);
  process.exit(1);
}

const catalog = JSON.parse(fs.readFileSync(dataPath, "utf8"));
const replace = process.env.SEED_REPLACE_CATALOG === "1";
let merchantId =
  process.env.SEED_MERCHANT_ID?.trim() || catalog.merchantId?.trim();

const client = new pg.Client({ connectionString: url });
await client.connect();

function emptyToNull(value) {
  if (value == null) return null;
  const trimmed = String(value).trim();
  return trimmed === "" ? null : trimmed;
}

async function insertOptionGroups(client, productId, optionGroups) {
  if (!Array.isArray(optionGroups) || optionGroups.length === 0) return 0;

  let inserted = 0;
  for (const group of optionGroups) {
    const choices = Array.isArray(group.choices) ? group.choices : [];
    if (choices.length === 0) continue;

    const groupId = crypto.randomUUID();
    await client.query(
      `INSERT INTO product_option_groups (
        id, product_id, name, name_ar, is_required, min_select, max_select, sort_order, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())`,
      [
        groupId,
        productId,
        group.name,
        emptyToNull(group.nameAr),
        group.isRequired ?? true,
        group.minSelect ?? 1,
        group.maxSelect ?? 1,
        group.sortOrder ?? 0,
      ],
    );

    for (const choice of choices) {
      await client.query(
        `INSERT INTO product_option_choices (
          id, group_id, name, name_ar, price_modifier, sort_order, is_active, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, true, NOW(), NOW())`,
        [
          crypto.randomUUID(),
          groupId,
          choice.name,
          emptyToNull(choice.nameAr),
          Number(choice.priceModifier ?? 0),
          choice.sortOrder ?? 0,
        ],
      );
    }
    inserted++;
  }
  return inserted;
}

async function replaceOptionGroups(client, productId, optionGroups) {
  await client.query(`DELETE FROM product_option_groups WHERE product_id = $1`, [
    productId,
  ]);
  return insertOptionGroups(client, productId, optionGroups);
}

try {
  await client.query("BEGIN");

  let merchantName = catalog.merchantName ?? "unknown";
  if (merchantId) {
    const merchantRes = await client.query(
      `SELECT id, name FROM merchants WHERE id = $1 LIMIT 1`,
      [merchantId],
    );
    if (merchantRes.rowCount === 0) {
      throw new Error(`Merchant not found for id ${merchantId}`);
    }
    merchantName = merchantRes.rows[0].name;
  } else {
    const merchantRes = await client.query(
      `SELECT id, name FROM merchants WHERE name = $1 LIMIT 1`,
      [catalog.merchantName],
    );
    if (merchantRes.rowCount === 0) {
      throw new Error(
        `Merchant "${catalog.merchantName}" not found. Set merchantId in JSON or SEED_MERCHANT_ID.`,
      );
    }
    merchantId = merchantRes.rows[0].id;
    merchantName = merchantRes.rows[0].name;
  }

  console.log(`Catalog: ${dataPath}`);
  console.log(`Merchant: ${merchantName} (${merchantId})`);

  if (replace) {
    await client.query(
      `DELETE FROM products
       WHERE category_id IN (
         SELECT id FROM merchant_categories WHERE merchant_id = $1
       )`,
      [merchantId],
    );
    await client.query(
      `DELETE FROM merchant_categories WHERE merchant_id = $1`,
      [merchantId],
    );
    console.log("Existing catalog removed (SEED_REPLACE_CATALOG=1).");
  }

  const categoryIdByName = new Map();

  const existingCats = await client.query(
    `SELECT id, name FROM merchant_categories WHERE merchant_id = $1`,
    [merchantId],
  );
  for (const row of existingCats.rows) {
    categoryIdByName.set(row.name, row.id);
  }

  let categoriesCreated = 0;
  let categoriesUpdated = 0;

  for (const cat of catalog.categories) {
    const existingId = categoryIdByName.get(cat.name);
    if (existingId) {
      await client.query(
        `UPDATE merchant_categories
         SET name_ar = $2, sort_order = $3, updated_at = NOW()
         WHERE id = $1`,
        [existingId, cat.nameAr ?? null, cat.sortOrder ?? 0],
      );
      categoriesUpdated++;
      continue;
    }

    const id = crypto.randomUUID();
    await client.query(
      `INSERT INTO merchant_categories (
        id, merchant_id, name, name_ar, sort_order, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
      [id, merchantId, cat.name, cat.nameAr ?? null, cat.sortOrder ?? 0],
    );
    categoryIdByName.set(cat.name, id);
    categoriesCreated++;
  }

  const existingProducts = await client.query(
    `SELECT p.id, p.name, p.category_id, c.name AS category_name
     FROM products p
     JOIN merchant_categories c ON c.id = p.category_id
     WHERE c.merchant_id = $1`,
    [merchantId],
  );
  const productIdByCategoryAndName = new Map();
  for (const row of existingProducts.rows) {
    productIdByCategoryAndName.set(`${row.category_name}::${row.name}`, row.id);
  }

  let productsCreated = 0;
  let productsSkipped = 0;
  let productsUpdated = 0;
  let optionGroupsCreated = 0;

  for (const product of catalog.products) {
    const categoryId = categoryIdByName.get(product.categoryName);
    if (!categoryId) {
      throw new Error(
        `Unknown category "${product.categoryName}" for product "${product.name}"`,
      );
    }

    const description = emptyToNull(product.description);
    const descriptionAr = emptyToNull(product.descriptionAr);
    const nameAr = emptyToNull(product.nameAr);
    const price = Number(product.price);
    const productKey = `${product.categoryName}::${product.name}`;
    let existingProductId = productIdByCategoryAndName.get(productKey);

    if (existingProductId) {
      if (replace) {
        productsSkipped++;
        continue;
      }
      await client.query(
        `UPDATE products
         SET name_ar = $2, description = $3, description_ar = $4, price = $5, updated_at = NOW()
         WHERE id = $1`,
        [existingProductId, nameAr, description, descriptionAr, price],
      );
      if (product.optionGroups !== undefined) {
        optionGroupsCreated += await replaceOptionGroups(
          client,
          existingProductId,
          product.optionGroups,
        );
      }
      productsUpdated++;
      continue;
    }

    const newId = crypto.randomUUID();
    await client.query(
      `INSERT INTO products (
        id, category_id, name, name_ar, description, description_ar, price, is_active, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, true, NOW(), NOW())`,
      [
        newId,
        categoryId,
        product.name,
        nameAr,
        description,
        descriptionAr,
        price,
      ],
    );
    if (product.optionGroups?.length) {
      optionGroupsCreated += await insertOptionGroups(
        client,
        newId,
        product.optionGroups,
      );
    }
    productIdByCategoryAndName.set(productKey, newId);
    productsCreated++;
  }

  await client.query("COMMIT");

  console.log("\nCatalog seed complete:");
  console.log(`  Categories created: ${categoriesCreated}`);
  console.log(`  Categories updated: ${categoriesUpdated}`);
  console.log(`  Products created:   ${productsCreated}`);
  console.log(`  Products updated:   ${productsUpdated}`);
  console.log(`  Products skipped:   ${productsSkipped}`);
  console.log(`  Option groups:      ${optionGroupsCreated}`);
} catch (err) {
  await client.query("ROLLBACK");
  console.error(err);
  process.exit(1);
} finally {
  await client.end();
}
