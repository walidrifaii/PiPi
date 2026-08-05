/**
 * Transform ADO menu JSON { categories, items } into seed-merchant-catalog.mjs format.
 * Applies a price markup (default +10%) to product and addon prices.
 *
 * Usage:
 *   node scripts/transform-ado-menu-catalog.mjs <source.json> <output.json> <merchantId> [markupMultiplier]
 */
import fs from "fs";
import path from "path";

const [sourcePath, outputPath, merchantIdArg, markupArg] = process.argv.slice(2);
if (!sourcePath || !outputPath || !merchantIdArg) {
  console.error(
    "Usage: node scripts/transform-ado-menu-catalog.mjs <source.json> <output.json> <merchantId> [markupMultiplier]",
  );
  process.exit(1);
}

const markup = Number(markupArg ?? process.env.PRICE_MARKUP ?? "1.1");
if (!Number.isFinite(markup) || markup <= 0) {
  console.error("Invalid markup multiplier:", markupArg ?? process.env.PRICE_MARKUP);
  process.exit(1);
}

const source = JSON.parse(fs.readFileSync(path.resolve(sourcePath), "utf8"));
if (!Array.isArray(source.categories) || !Array.isArray(source.items)) {
  console.error("Source must be { categories: [], items: [] }.");
  process.exit(1);
}

function trim(value) {
  if (value == null) return "";
  return String(value).trim();
}

function roundPrice(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * markup * 100) / 100;
}

function emptyToNull(value) {
  const trimmed = trim(value);
  return trimmed === "" ? null : trimmed;
}

const categoryNames = new Set();
const categories = [];
for (const cat of source.categories) {
  const name = trim(cat?.name).slice(0, 255);
  if (!name) continue;
  categoryNames.add(name);
  categories.push({
    name,
    nameAr: emptyToNull(cat?.name_ar ?? cat?.nameAr),
    sortOrder: Number(cat?.order) > 0 ? Number(cat.order) : categories.length + 1,
  });
}

const products = [];
let skippedItems = 0;
let dedupedItems = 0;
const seenInCategory = new Map();

for (const item of source.items) {
  let productName = trim(item?.name).slice(0, 255);
  const categoryName = trim(item?.category).slice(0, 255);
  if (!productName || !categoryName) {
    skippedItems++;
    continue;
  }
  if (!categoryNames.has(categoryName)) {
    console.warn(`Skipping "${productName}": unknown category "${categoryName}"`);
    skippedItems++;
    continue;
  }

  const dedupeKey = `${categoryName}::${productName}`;
  const count = seenInCategory.get(dedupeKey) ?? 0;
  if (count > 0) {
    dedupedItems++;
    productName = `${productName.slice(0, 250)} (${count + 1})`;
  }
  seenInCategory.set(dedupeKey, count + 1);

  const product = {
    name: productName,
    nameAr: emptyToNull(item?.name_ar ?? item?.nameAr),
    description: emptyToNull(item?.description),
    descriptionAr: emptyToNull(item?.description_ar ?? item?.descriptionAr),
    categoryName,
    price: roundPrice(item?.price),
  };

  const addons = Array.isArray(item?.addons) ? item.addons : [];
  if (addons.length > 0) {
    const choices = [];
    for (let i = 0; i < addons.length; i++) {
      const addon = addons[i];
      const choiceName = trim(addon?.name).slice(0, 255);
      if (!choiceName) continue;
      choices.push({
        name: choiceName,
        nameAr: emptyToNull(addon?.name_ar ?? addon?.nameAr),
        priceModifier: roundPrice(addon?.price),
        sortOrder: i + 1,
      });
    }
    if (choices.length > 0) {
      product.optionGroups = [
        {
          name: "Addons",
          nameAr: "إضافات",
          isRequired: false,
          minSelect: 0,
          maxSelect: choices.length,
          sortOrder: 1,
          choices,
        },
      ];
    }
  }

  products.push(product);
}

const catalog = {
  merchantId: merchantIdArg,
  categories,
  products,
};

fs.mkdirSync(path.dirname(path.resolve(outputPath)), { recursive: true });
fs.writeFileSync(path.resolve(outputPath), JSON.stringify(catalog, null, 2), "utf8");

console.log(`Wrote ${outputPath}`);
console.log(`  Merchant:   ${merchantIdArg}`);
console.log(`  Markup:     ${markup === 1 ? "same prices" : `${Math.round((markup - 1) * 100)}% (x${markup})`}`);
console.log(`  Categories: ${categories.length}`);
console.log(`  Products:   ${products.length}`);
console.log(`  With addons:${products.filter((p) => p.optionGroups?.length).length}`);
console.log(`  Skipped (empty name): ${skippedItems}`);
console.log(`  Deduped (same name in category): ${dedupedItems}`);
