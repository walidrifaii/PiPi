import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const MAX_BYTES = 100 * 1024;
const ASSETS_DIR =
  'C:/Users/DELL/.cursor/projects/c-Users-DELL-Desktop-Athar/assets';
const OUT_DIR = 'C:/Users/DELL/Desktop/Athar/category-images';

const images = [
  { src: '31-tissues-paper-goods.png', out: '31-tissues-paper-goods.webp', label: 'المحارم والورقيات' },
  { src: '32-bags-packaging.png', out: '32-bags-packaging.webp', label: 'الأكياس والتغليف' },
  { src: '33-tableware-supplies.png', out: '33-tableware-supplies.webp', label: 'مستلزمات السفرة' },
  { src: '34-hair-care.png', out: '34-hair-care.webp', label: 'العناية بالشعر' },
  { src: '35-soap-bath.png', out: '35-soap-bath.webp', label: 'الصابون والاستحمام' },
  { src: '36-deodorants-perfumes.png', out: '36-deodorants-perfumes.webp', label: 'مزيلات العرق والعطور' },
  { src: '37-personal-health-care.png', out: '37-personal-health-care.webp', label: 'العناية الشخصية والصحية' },
  { src: '38-oral-dental-care.png', out: '38-oral-dental-care.webp', label: 'العناية بالفم والأسنان' },
  { src: '39-sanitary-pads.png', out: '39-sanitary-pads.webp', label: 'الفوط الصحية' },
  { src: '40-baby-diapers.png', out: '40-baby-diapers.webp', label: 'حفاضات الأطفال' },
  { src: '41-shaving.png', out: '41-shaving.webp', label: 'الحلاقة' },
  { src: '42-tobacco-shisha-supplies.png', out: '42-tobacco-shisha-supplies.webp', label: 'الدخان والمعسل ولوازمه' },
  { src: '43-charcoal-hookah-supplies.png', out: '43-charcoal-hookah-supplies.webp', label: 'الفحم ولوازم النرجيلة' },
  { src: '44-toys.png', out: '44-toys.webp', label: 'الألعاب' },
  { src: '45-stationery.png', out: '45-stationery.webp', label: 'القرطاسية' },
  { src: '46-batteries-electrical-supplies.png', out: '46-batteries-electrical-supplies.webp', label: 'البطاريات واللوازم الكهربائية' },
  { src: '47-eggs.png', out: '47-eggs.webp', label: 'البيض' },
  { src: '48-household-misc.png', out: '48-household-misc.webp', label: 'متفرقات منزلية' },
];

async function compressToTarget(inputPath, outputPath, maxBytes) {
  const meta = await sharp(inputPath).metadata();
  let width = meta.width;
  let height = meta.height;

  for (let resizeAttempt = 0; resizeAttempt < 4; resizeAttempt++) {
    let low = 20;
    let high = 95;
    let best = null;

    while (low <= high) {
      const quality = Math.floor((low + high) / 2);
      const buffer = await sharp(inputPath)
        .resize(width, height, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality, effort: 6 })
        .toBuffer();

      if (buffer.length <= maxBytes) {
        best = buffer;
        low = quality + 1;
      } else {
        high = quality - 1;
      }
    }

    if (best) {
      await fs.promises.writeFile(outputPath, best);
      return { bytes: best.length, width, height };
    }

    width = Math.round(width * 0.85);
    height = Math.round(height * 0.85);
  }

  throw new Error(`Could not compress under ${maxBytes} bytes: ${inputPath}`);
}

fs.mkdirSync(OUT_DIR, { recursive: true });

const results = [];
for (const image of images) {
  const inputPath = path.join(ASSETS_DIR, image.src);
  const outputPath = path.join(OUT_DIR, image.out);
  if (!fs.existsSync(inputPath)) {
    console.error(`Missing: ${inputPath}`);
    continue;
  }
  const inputStat = fs.statSync(inputPath);
  const result = await compressToTarget(inputPath, outputPath, MAX_BYTES);
  results.push({
    label: image.label,
    file: image.out,
    beforeKB: (inputStat.size / 1024).toFixed(1),
    afterKB: (result.bytes / 1024).toFixed(1),
    dimensions: `${result.width}x${result.height}`,
  });
}

console.log('\nCompression complete:\n');
for (const row of results) {
  console.log(
    `${row.file} | ${row.label} | ${row.beforeKB} KB -> ${row.afterKB} KB | ${row.dimensions}`,
  );
}
