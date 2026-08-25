/**
 * Builds scripts/data/smile-bar.json from the Smile Bar menu JSON.
 * Each size variant becomes its own product. Prices convert LBP -> USD
 * at 1 USD = 90,000 LBP.
 *
 * Run: node scripts/generate-smile-bar-catalog.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sourcePath = path.join(__dirname, "data", "smile-bar-menu.json");
const outPath = path.join(__dirname, "data", "smile-bar.json");

const MERCHANT_ID = "43590947-5578-4ce5-b42f-630177051456";
const LBP_PER_USD = 90000;

const SIZE_EN = {
  S: "Small",
  M: "Medium",
  L: "Large",
};
const SIZE_AR = {
  S: "صغير",
  M: "وسط",
  L: "كبير",
};

function emptyToNull(value) {
  if (value == null) return null;
  const trimmed = String(value).trim();
  return trimmed === "" ? null : trimmed;
}

function lbpToUsd(priceLbp) {
  if (priceLbp == null || Number.isNaN(Number(priceLbp))) return 0;
  return Math.round((Number(priceLbp) / LBP_PER_USD) * 100) / 100;
}

function sizeLabel(size, map) {
  const key = String(size ?? "").trim();
  return map[key] ?? key;
}

const source = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
const categoryById = new Map(source.categories.map((cat) => [cat.id, cat]));

const categories = source.categories.map((cat, index) => ({
  name: cat.name,
  nameAr: emptyToNull(cat.nameAr),
  sortOrder: index + 1,
}));

const products = [];

for (const item of source.items) {
  const category = categoryById.get(item.categoryId);
  if (!category) {
    throw new Error(
      `Unknown categoryId "${item.categoryId}" for product "${item.name}"`,
    );
  }

  const description = emptyToNull(item.description);
  const descriptionAr = emptyToNull(item.descriptionAr);
  const variants = Array.isArray(item.variants) ? item.variants : [];

  if (variants.length > 0) {
    for (const variant of variants) {
      const sizeEn = sizeLabel(variant.size, SIZE_EN);
      const sizeAr = sizeLabel(variant.size, SIZE_AR);
      products.push({
        name: `${item.name} (${sizeEn})`,
        nameAr: item.nameAr ? `${item.nameAr} (${sizeAr})` : null,
        description,
        descriptionAr,
        price: lbpToUsd(variant.price),
        categoryName: category.name,
      });
    }
    continue;
  }

  products.push({
    name: item.name,
    nameAr: emptyToNull(item.nameAr),
    description,
    descriptionAr,
    price: lbpToUsd(item.price),
    categoryName: category.name,
  });
}

const catalog = {
  merchantId: MERCHANT_ID,
  merchantName: source.restaurant?.name ?? "Smile Bar",
  categories,
  products,
};

fs.writeFileSync(outPath, `${JSON.stringify(catalog, null, 2)}\n`, "utf8");
console.log(`Wrote ${outPath}`);
console.log(`  Categories: ${categories.length}`);
console.log(`  Products:   ${products.length}`);
