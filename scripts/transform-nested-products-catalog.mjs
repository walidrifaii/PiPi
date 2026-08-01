/**
 * Transform nested products JSON [{ name, items: [{ name, price }] }]
 * into seed-merchant-catalog.mjs format.
 *
 * Usage:
 *   node scripts/transform-nested-products-catalog.mjs <source.json> <output.json> [merchantId]
 */
import fs from "fs";
import path from "path";

const [sourcePath, outputPath, merchantIdArg] = process.argv.slice(2);
if (!sourcePath || !outputPath) {
  console.error(
    "Usage: node scripts/transform-nested-products-catalog.mjs <source.json> <output.json> [merchantId]",
  );
  process.exit(1);
}

const source = JSON.parse(fs.readFileSync(path.resolve(sourcePath), "utf8"));
if (!Array.isArray(source)) {
  console.error("Source must be a JSON array of { name, items }.");
  process.exit(1);
}

function trimName(value) {
  if (value == null) return "";
  return String(value).trim();
}

function roundPrice(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100) / 100;
}

const categories = [];
const products = [];
let skippedItems = 0;
let dedupedItems = 0;

source.forEach((section, index) => {
  const categoryName = trimName(section?.name);
  if (!categoryName) {
    console.warn(`Skipping category at index ${index}: missing name`);
    return;
  }

  categories.push({
    name: categoryName.slice(0, 255),
    sortOrder: index + 1,
  });

  const seenInCategory = new Map();
  const items = Array.isArray(section.items) ? section.items : [];

  for (const item of items) {
    let productName = trimName(item?.name);
    if (!productName) {
      skippedItems++;
      continue;
    }
    productName = productName.slice(0, 255);

    const count = seenInCategory.get(productName) ?? 0;
    if (count > 0) {
      dedupedItems++;
      productName = `${productName.slice(0, 250)} (${count + 1})`;
    }
    seenInCategory.set(trimName(item?.name).slice(0, 255), count + 1);

    products.push({
      name: productName,
      categoryName: categoryName.slice(0, 255),
      price: roundPrice(item?.price),
    });
  }
});

const catalog = {
  ...(merchantIdArg ? { merchantId: merchantIdArg } : {}),
  categories,
  products,
};

fs.mkdirSync(path.dirname(path.resolve(outputPath)), { recursive: true });
fs.writeFileSync(path.resolve(outputPath), JSON.stringify(catalog, null, 2), "utf8");

console.log(`Wrote ${outputPath}`);
console.log(`  Categories: ${categories.length}`);
console.log(`  Products:   ${products.length}`);
console.log(`  Skipped (empty name): ${skippedItems}`);
console.log(`  Deduped (same name in category): ${dedupedItems}`);
