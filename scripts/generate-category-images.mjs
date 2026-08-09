/**
 * Generate category icon PNGs (512px gradient tiles when sharp is available).
 *
 * Usage (from PiPi/):
 *   node scripts/generate-category-images.mjs
 *   node scripts/generate-category-images.mjs scripts/data/merchant-17423af2-catalog.json
 *   CATEGORY_IMAGE_FROM=31 CATEGORY_IMAGE_TO=48 node scripts/generate-category-images.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  CATEGORY_IMAGE_STYLES,
  defaultStyleForCategory,
  slugifyCategoryName,
} from "./category-image-styles.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const catalogPath = path.resolve(
  process.cwd(),
  process.argv[2]?.trim() || "scripts/data/merchant-17423af2-catalog.json",
);

const TWEMOJI_72 =
  "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72";

function parseRange() {
  const from = Number(process.env.CATEGORY_IMAGE_FROM ?? process.argv[3] ?? 1);
  const to = Number(
    process.env.CATEGORY_IMAGE_TO ?? process.argv[4] ?? Number.MAX_SAFE_INTEGER,
  );
  if (!Number.isFinite(from) || !Number.isFinite(to) || from < 1 || to < from) {
    throw new Error("Invalid range. Use CATEGORY_IMAGE_FROM and CATEGORY_IMAGE_TO (1-based).");
  }
  return { from, to };
}

async function loadSharp() {
  try {
    const mod = await import("sharp");
    return mod.default;
  } catch {
    return null;
  }
}

async function fetchEmojiPng(code) {
  const normalized = String(code).toLowerCase().replace(/^0x/, "");
  const url = `${TWEMOJI_72}/${normalized}.png`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch emoji ${code} from ${url} (${res.status})`);
  }
  return Buffer.from(await res.arrayBuffer());
}

function gradientSvg(from, to) {
  return Buffer.from(
    `<svg width="512" height="512" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${from}"/>
          <stop offset="100%" stop-color="${to}"/>
        </linearGradient>
      </defs>
      <rect width="512" height="512" rx="96" fill="url(#g)"/>
      <rect x="24" y="24" width="464" height="464" rx="80" fill="rgba(255,255,255,0.2)"/>
    </svg>`,
  );
}

async function buildTile(sharp, style, emojiBuf) {
  if (!sharp) return emojiBuf;
  const emojiSize = 280;
  const emoji = await sharp(emojiBuf)
    .resize(emojiSize, emojiSize, { fit: "contain" })
    .png()
    .toBuffer();
  const bg = await sharp(gradientSvg(style.from, style.to)).png().toBuffer();
  return sharp(bg)
    .composite([{ input: emoji, gravity: "center" }])
    .png({ compressionLevel: 9 })
    .toBuffer();
}

if (!fs.existsSync(catalogPath)) {
  console.error(`Catalog not found: ${catalogPath}`);
  process.exit(1);
}

const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
const merchantId =
  process.env.SEED_MERCHANT_ID?.trim() ||
  catalog.merchantId ||
  "17423af2-31c3-4b11-91f3-e0ee7e095200";
const range = parseRange();

const outDir = path.join(__dirname, "data", "category-images", merchantId);
fs.mkdirSync(outDir, { recursive: true });

const manifestPath = path.join(outDir, "manifest.json");
const existingManifest = fs.existsSync(manifestPath)
  ? JSON.parse(fs.readFileSync(manifestPath, "utf8"))
  : { merchantId, categories: [] };
const manifestByName = new Map(
  existingManifest.categories.map((entry) => [entry.name, entry]),
);

const sharp = await loadSharp();
if (!sharp) {
  console.log("sharp not installed — saving 72x72 emoji PNGs (npm i -D sharp for 512px tiles)");
}

console.log(
  `Generating category images ${range.from}-${Math.min(range.to, catalog.categories.length)} → ${outDir}`,
);

let generated = 0;

for (let i = 0; i < catalog.categories.length; i++) {
  const number = i + 1;
  if (number < range.from || number > range.to) continue;

  const cat = catalog.categories[i];
  const name = cat.name?.trim();
  if (!name) continue;

  const style =
    CATEGORY_IMAGE_STYLES[name] ?? defaultStyleForCategory(name, i);
  const slug = slugifyCategoryName(name) || `category-${number}`;
  const fileName = `${String(number).padStart(2, "0")}-${slug}.png`;
  const filePath = path.join(outDir, fileName);

  const emojiBuf = await fetchEmojiPng(style.emoji);
  const png = await buildTile(sharp, style, emojiBuf);
  fs.writeFileSync(filePath, png);

  const entry = {
    name,
    fileName,
    relativePath: path
      .relative(path.join(__dirname, ".."), filePath)
      .replace(/\\/g, "/"),
    emoji: style.emoji,
    cdnUrl: `${TWEMOJI_72}/${String(style.emoji).toLowerCase()}.png`,
    gradient: { from: style.from, to: style.to },
  };
  manifestByName.set(name, entry);
  generated++;
  console.log(`  ✓ ${fileName}  (${name})`);
}

const mergedCategories = catalog.categories
  .map((cat) => manifestByName.get(cat.name?.trim()))
  .filter(Boolean);

const manifest = {
  merchantId,
  generatedAt: new Date().toISOString(),
  tileSize: sharp ? 512 : 72,
  categories: mergedCategories,
};
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf8");

console.log(`\nDone: ${generated} image(s) regenerated`);
console.log(`Manifest: ${manifestPath}`);
