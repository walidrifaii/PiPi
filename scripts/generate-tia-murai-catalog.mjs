/**
 * Builds scripts/data/tia-murai.json from the TIA MURAI menu JSON.
 * Maps only fields that exist on merchant_categories / products.
 *
 * Run: node scripts/generate-tia-murai-catalog.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sourcePath = path.join(__dirname, "data", "tia-murai-menu.json");
const outPath = path.join(__dirname, "data", "tia-murai.json");

const MERCHANT_ID = "abfed4d3-25ea-427f-b625-627d2b2b080d";

function emptyToNull(value) {
  if (value == null) return null;
  const trimmed = String(value).trim();
  return trimmed === "" ? null : trimmed;
}

const source = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
const categoryById = new Map(source.categories.map((cat) => [cat.id, cat]));

const categories = source.categories.map((cat, index) => ({
  name: cat.name,
  nameAr: emptyToNull(cat.nameAr),
  sortOrder: index + 1,
}));

const products = source.items.map((item) => {
  const category = categoryById.get(item.categoryId);
  if (!category) {
    throw new Error(
      `Unknown categoryId "${item.categoryId}" for product "${item.name}"`,
    );
  }

  return {
    name: item.name,
    nameAr: emptyToNull(item.nameAr),
    description: emptyToNull(item.description),
    descriptionAr: emptyToNull(item.descriptionAr),
    price: item.price == null ? 0 : Number(item.price),
    categoryName: category.name,
  };
});

const catalog = {
  merchantId: MERCHANT_ID,
  merchantName: source.restaurant?.name ?? "TIA MURAI",
  categories,
  products,
};

fs.writeFileSync(outPath, `${JSON.stringify(catalog, null, 2)}\n`, "utf8");
console.log(`Wrote ${outPath}`);
console.log(`  Categories: ${categories.length}`);
console.log(`  Products:   ${products.length}`);
