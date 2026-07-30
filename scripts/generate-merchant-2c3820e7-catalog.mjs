/**
 * Builds scripts/data/merchant-2c3820e7-catalog.json from raw menu chunks.
 * Run: node scripts/generate-merchant-2c3820e7-catalog.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outPath = path.join(__dirname, "data", "merchant-2c3820e7-catalog.json");

const MERCHANT_ID = "2c3820e7-3abd-4d2c-9ee6-e90f3b614b6e";

const chunks = [
  {
    categories: [
      { name: "Cheese", name_ar: "جبنة", order: 1 },
      { name: "Meat", name_ar: "لحمة", order: 2 },
    ],
    items: [
      { name: "جبنة", description: "جبنة عكاوي وموزاريلا", categories: ["Cheese"], price: 2.22 },
      { name: "جبنة قشقوان", description: "جبنة موزاريلا وعكاوي وقشقوان", categories: ["Cheese"], price: 3.0 },
      { name: "جبنة مع خضرة", description: "جبنة عكاوي وموزاريلا مع بندورة وزيتون وفليفلة حلوة، والذرة حسب الطلب", categories: ["Cheese"], price: 3.0 },
      { name: "جبنة مع سجق", description: "جبنة موزاريلا وعكاوي مع سجق", categories: ["Cheese"], price: 2.5 },
      { name: "جبنة مع مرتديلا", description: "جبنة عكاوي وموزاريلا مع مرتديلا", categories: ["Cheese"], price: 3.0 },
      { name: "جبنة ذرة", description: "جبنة عكاوي وموزاريلا مع ذرة", categories: ["Cheese"], price: 2.22 },
      { name: "جبنة قشقوان مع سجق", description: "جبنة موزاريلا وعكاوي وقشقوان مع سجق", categories: ["Cheese"], price: 3.55 },
      { name: "جبنة سجق مع خضرة", description: "جبنة عكاوي وموزاريلا مع بندورة وزيتون وفليفلة حلوة وسجق", categories: ["Cheese"], price: 3.55 },
      { name: "جبنة مرتديلا قشقوان", description: "جبنة عكاوي وموزاريلا وقشقوان مع مرتديلا", categories: ["Cheese"], price: 3.55 },
      { name: "جبنة خضرة مع مرتديلا", description: "جبنة موزاريلا وعكاوي مع بندورة وزيتون وفليفلة حلوة ومرتديلا", categories: ["Cheese"], price: 3.55 },
      { name: "دوبلاكس", description: "منقوشة جبنة وفوقها منقوشة زعتر", categories: ["Cheese"], price: 3.0 },
      { name: "جبنة قشقوان مع خضرة", description: "جبنة عكاوي وموزاريلا وقشقوان مع بندورة وزيتون وفليفلة حلوة", categories: ["Cheese"], price: 3.55 },
      { name: "جبنة مع رشة زعتر", description: "جبنة عكاوي وموزاريلا مع رشة زعتر", categories: ["Cheese"], price: 2.22 },
      { name: "جبنة مع ببروني", description: "جبنة عكاوي وموزاريلا مع ببروني", categories: ["Cheese"], price: 3.0 },
      { name: "جبنة ببروني مع خضرة", description: "جبنة موزاريلا وعكاوي مع خضرة وببروني", categories: ["Cheese"], price: 3.55 },
      { name: "جبنة قشقوان مع ببروني", description: "جبنة قشقوان وموزاريلا وعكاوي مع ببروني", categories: ["Cheese"], price: 3.55 },
      { name: "جبنة قشقوان مع ببروني وخضرة", description: "جبنة موزاريلا وقشقوان وعكاوي مع ببروني وخضرة", categories: ["Cheese"], price: 4.0 },
      { name: "لحمة", description: "لحمة مفرومة مع بندورة وبصل وفليفلة حلوة", categories: ["Meat"], price: 2.22 },
      { name: "نصف لحمة نصف جبنة", description: "نصف المنقوشة لحمة والنصف الآخر جبنة", categories: ["Meat"], price: 2.22 },
      { name: "لحمة مع جبنة", description: "لحمة مفرومة مع بندورة وبصل وفليفلة حلوة وعليها جبنة موزاريلا", categories: ["Meat"], price: 3.0 },
      { name: "لحمة مع خضرة", description: "لحمة مع بندورة وزيتون وفليفلة حلوة", categories: ["Meat"], price: 3.0 },
      { name: "سمت بدن", description: "لحمة مع فطر وذرة وعليها جبنة", categories: ["Meat"], price: 3.33 },
      { name: "لحمة مع جبنة وخضرة", description: "لحمة مع بندورة وزيتون وفليفلة حلوة وجبنة", categories: ["Meat"], price: 3.33 },
    ],
  },
  {
    categories: [{ name: "Zaatar", name_ar: "زعتر", order: 3 }],
    items: [
      { name: "زعتر", description: "زعتر مع زيت", categories: ["Zaatar"], price: 1.0 },
      { name: "زعتر مع خضرة", description: "زعتر وزيت مع بندورة وزيتون وفليفلة حلوة", categories: ["Zaatar"], price: 1.55 },
      { name: "نصف جبنة نصف زعتر", description: "نصف زعتر مع زيت ونصف جبنة عكاوي وموزاريلا", categories: ["Zaatar"], price: 1.88 },
      { name: "زعتر مع لبنة", description: "زعتر وزيت مع لبنة", categories: ["Zaatar"], price: 1.55 },
      { name: "زعتر مع لبنة ومرتديلا", description: "زعتر وزيت مع لبنة ومرتديلا", categories: ["Zaatar"], price: 2.44 },
      { name: "زعتر مع جبنة", description: "زعتر وزيت وعليها جبنة موزاريلا", categories: ["Zaatar"], price: 1.88 },
      { name: "زعتر مع لبنة وخضرة", description: "زعتر وزيت مع لبنة وبندورة وفليفلة حلوة وزيتون", categories: ["Zaatar"], price: 2.0 },
      { name: "زعتر مع خضرة ومرتديلا", description: "زعتر وزيت مع بندورة وزيتون وفليفلة حلوة ومرتديلا", categories: ["Zaatar"], price: 2.0 },
      { name: "زعتر مع لبنة ومرتديلا وخضرة", description: "زعتر مع لبنة وبندورة وزيتون وفليفلة حلوة ومرتديلا", categories: ["Zaatar"], price: 2.44 },
      { name: "نصف زعتر نصف قشقوان", description: "زعتر وزيت مع جبنة عكاوي وموزاريلا وقشقوان", categories: ["Zaatar"], price: 2.0 },
      { name: "زعتر مع جبنة وخضرة", description: "زعتر وزيت مع بندورة وزيتون وفليفلة حلوة وعليها جبنة موزاريلا", categories: ["Zaatar"], price: 2.11 },
    ],
  },
  {
    categories: [{ name: "Areesh", name_ar: "أريش", order: 4 }],
    items: [
      { name: "أريش", description: "أريش متبل مع بندورة وبصل وفليفلة مفرومة وزيت", categories: ["Areesh"], price: 2.0 },
      { name: "نصف أريش نصف جبنة", description: "نصف أريش متبل ونصف جبنة عكاوي وموزاريلا", categories: ["Areesh"], price: 2.0 },
      { name: "أريش مع جبنة", description: "أريش متبل وعليه جبنة موزاريلا", categories: ["Areesh"], price: 3.0 },
      { name: "أريش مع خضرة", description: "أريش متبل مع بندورة وزيتون وفليفلة حلوة", categories: ["Areesh"], price: 3.0 },
      { name: "أريش مع جبنة وخضرة", description: "أريش متبل مع بندورة وزيتون وفليفلة حلوة وجبنة موزاريلا", categories: ["Areesh"], price: 3.66 },
    ],
  },
  {
    categories: [{ name: "Kaak", name_ar: "كعك", order: 5 }],
    items: [
      { name: "كعك بجبنة", description: "جبنة عكاوي وموزاريلا", categories: ["Kaak"], price: 1.67 },
      { name: "كعك ذرة", description: "جبنة موزاريلا وعكاوي مع ذرة", categories: ["Kaak"], price: 1.67 },
      { name: "كعك قشقوان", description: "جبنة موزاريلا وعكاوي وقشقوان", categories: ["Kaak"], price: 1.88 },
      { name: "كعك خضرة", description: "جبنة عكاوي وموزاريلا مع بندورة وزيتون وفليفلة حلوة", categories: ["Kaak"], price: 1.88 },
      { name: "كعك قشقوان مع خضرة", description: "جبنة موزاريلا وقشقوان وعكاوي مع بندورة وزيتون وفليفلة حلوة", categories: ["Kaak"], price: 2.77 },
      { name: "كعك سجق", description: "جبنة موزاريلا وعكاوي مع سجق", categories: ["Kaak"], price: 2.44 },
      { name: "كعك مرتديلا", description: "جبنة موزاريلا وعكاوي مع مرتديلا", categories: ["Kaak"], price: 2.44 },
      { name: "كعك فاهيتا", description: "فاهيتا متبلة مع جبنة موزاريلا", categories: ["Kaak"], price: 2.44 },
      { name: "كعك دجاج", description: "دجاج متبل على طريقة الطاووق مع جبنة موزاريلا", categories: ["Kaak"], price: 2.44 },
      { name: "كعك خضرة وسجق", description: "جبنة موزاريلا وعكاوي مع زيتون وبندورة وفليفلة حلوة وسجق", categories: ["Kaak"], price: 2.77 },
      { name: "كعك مرتديلا مع خضرة", description: "جبنة موزاريلا وعكاوي مع بندورة وزيتون وفليفلة حلوة ومرتديلا", categories: ["Kaak"], price: 2.77 },
      { name: "كعك قشقوان وفاهيتا", description: "فاهيتا مع جبنة موزاريلا وقشقوان", categories: ["Kaak"], price: 3.11 },
      { name: "كعك دجاج وقشقوان", description: "دجاج متبل مع جبنة موزاريلا وقشقوان", categories: ["Kaak"], price: 3.11 },
      { name: "كعك بخميس", description: "حليب وطحين ويانسون وسمن بلدي وحبة البركة", categories: ["Kaak"], price: 0.77 },
    ],
  },
  {
    categories: [
      { name: "Labneh", name_ar: "لبنة", order: 6 },
      { name: "Special", name_ar: "مميز", order: 7 },
      { name: "Soiree", name_ar: "سواريه", order: 8 },
      { name: "Fajita Pizza", name_ar: "بيتزا فاهيتا", order: 9 },
      { name: "Chicken Pizza", name_ar: "بيتزا دجاج", order: 10 },
      { name: "Vegetable Pizza", name_ar: "بيتزا خضرة", order: 11 },
      { name: "Mortadella Pizza", name_ar: "بيتزا مرتديلا", order: 12 },
      { name: "Sujuk Pizza", name_ar: "بيتزا سجق", order: 13 },
      { name: "Margherita Pizza", name_ar: "بيتزا مارغريتا", order: 14 },
      { name: "Pepperoni Pizza", name_ar: "بيتزا ببروني", order: 15 },
    ],
    items: [
      { name: "لبنة مع خضرة", description: "لبنة مع بندورة وزيتون وفليفلة حلوة", categories: ["Labneh"], price: 1.88 },
      { name: "لبنة مع مرتديلا", description: "لبنة مع بندورة وزيتون وفليفلة حلوة ومرتديلا", categories: ["Labneh"], price: 3.0 },
      { name: "لحم بعجين", description: "لحمة مع دبس رمان وبصل", categories: ["Special"], price: 1.33 },
      { name: "نصف دزينة لحم بعجين", description: "6 حبات لحم بعجين", categories: ["Special"], price: 6.66 },
      { name: "دزينة لحم بعجين", description: "12 حبة لحم بعجين", categories: ["Special"], price: 13.33 },
      { name: "فطيرة جبنة أو سبانخ أو بيتزا", description: "سعر الحبة الواحدة، والاختيار بين الجبنة أو السبانخ أو البيتزا", categories: ["Special"], price: 1.33 },
      { name: "دزينة فطائر مشكلة", description: "12 حبة فطائر، والاختيار بين الجبنة أو الأريش أو السبانخ أو البيتزا", categories: ["Special"], price: 13.33 },
      { name: "نصف دزينة فطائر مشكلة", description: "6 حبات فطائر، والاختيار بين السبانخ أو الأريش أو الجبنة أو البيتزا", categories: ["Special"], price: 6.66 },
      { name: "منقوشة فاهيتا", description: "فاهيتا متبلة وعليها جبنة", categories: ["Special"], price: 4.44 },
      { name: "منقوشة دجاج", description: "دجاج متبل على طريقة الطاووق وعليه جبنة", categories: ["Special"], price: 4.44 },
      { name: "تركية", description: "بندورة وفليفلة وبصل مفروم مع فلفل حار مطحون ناعم وعليها جبنة", categories: ["Special"], price: 2.0 },
      { name: "منقوشة حارة", description: "فلفل حار مطحون", categories: ["Special"], price: 1.0 },
      { name: "نصف زعتر نصف حارة", description: "نصف زعتر مع زيت ونصف فلفل حار مطحون", categories: ["Special"], price: 1.0 },
      { name: "نصف جبنة نصف حارة", description: "نصف جبنة عكاوي وموزاريلا ونصف فلفل حار مطحون", categories: ["Special"], price: 1.88 },
      { name: "دزينة سواريه", description: "12 قطعة مشكلة من البيتزا والجبنة والأريش والسبانخ والبعلبكية والفاهيتا ولحم بعجين", categories: ["Soiree"], price: 5.55 },
      { name: "بيتزا فاهيتا صغيرة", description: "صوص بيتزا مع فاهيتا متبلة وجبنة موزاريلا وقشقوان", categories: ["Fajita Pizza"], price: 6.66 },
      { name: "بيتزا فاهيتا وسط", description: "صوص بيتزا مع فاهيتا متبلة وجبنة موزاريلا وقشقوان", categories: ["Fajita Pizza"], price: 11.11 },
      { name: "بيتزا فاهيتا كبيرة", description: "صوص بيتزا مع فاهيتا متبلة وجبنة موزاريلا وقشقوان", categories: ["Fajita Pizza"], price: 16.66 },
      { name: "بيتزا دجاج صغيرة", description: "صوص بيتزا مع دجاج متبل على طريقة الطاووق وجبنة موزاريلا وقشقوان", categories: ["Chicken Pizza"], price: 6.66 },
      { name: "بيتزا دجاج وسط", description: "صوص بيتزا مع دجاج متبل على طريقة الطاووق وجبنة موزاريلا وقشقوان", categories: ["Chicken Pizza"], price: 11.11 },
      { name: "بيتزا دجاج كبيرة", description: "صوص بيتزا مع دجاج متبل على طريقة الطاووق وجبنة موزاريلا وقشقوان", categories: ["Chicken Pizza"], price: 16.66 },
      { name: "بيتزا خضرة صغيرة", description: "زيتون وفليفلة وفطر وذرة مع جبنة موزاريلا وقشقوان", categories: ["Vegetable Pizza"], price: 5.55 },
      { name: "بيتزا خضرة وسط", description: "زيتون وفليفلة وفطر وذرة مع جبنة موزاريلا وقشقوان", categories: ["Vegetable Pizza"], price: 8.88 },
      { name: "بيتزا خضرة كبيرة", description: "زيتون وفليفلة وفطر وذرة مع جبنة موزاريلا وقشقوان", categories: ["Vegetable Pizza"], price: 13.33 },
      { name: "بيتزا مرتديلا صغيرة", description: "صوص بيتزا مع زيتون وفليفلة وفطر وذرة وجبنة قشقوان وموزاريلا ومرتديلا", categories: ["Mortadella Pizza"], price: 6.66 },
      { name: "بيتزا مرتديلا وسط", description: "صوص بيتزا مع زيتون وفليفلة وفطر وذرة وجبنة قشقوان وموزاريلا ومرتديلا", categories: ["Mortadella Pizza"], price: 11.11 },
      { name: "بيتزا مرتديلا كبيرة", description: "صوص بيتزا مع زيتون وفليفلة وفطر وذرة وجبنة قشقوان وموزاريلا ومرتديلا", categories: ["Mortadella Pizza"], price: 16.66 },
      { name: "بيتزا سجق صغيرة", description: "صوص بيتزا مع زيتون وفليفلة وفطر وذرة وجبنة قشقوان وموزاريلا وسجق", categories: ["Sujuk Pizza"], price: 6.66 },
      { name: "بيتزا سجق وسط", description: "صوص بيتزا مع زيتون وفليفلة وفطر وذرة وجبنة قشقوان وموزاريلا وسجق", categories: ["Sujuk Pizza"], price: 11.11 },
      { name: "بيتزا سجق كبيرة", description: "صوص بيتزا مع زيتون وفليفلة وفطر وذرة وجبنة قشقوان وموزاريلا وسجق", categories: ["Sujuk Pizza"], price: 16.66 },
      { name: "بيتزا مارغريتا صغيرة", description: "صوص بيتزا مع جبنة موزاريلا وقشقوان", categories: ["Margherita Pizza"], price: 5.55 },
      { name: "بيتزا مارغريتا وسط", description: "صوص بيتزا مع جبنة موزاريلا وقشقوان", categories: ["Margherita Pizza"], price: 8.88 },
      { name: "بيتزا مارغريتا كبيرة", description: "صوص بيتزا مع جبنة موزاريلا وقشقوان", categories: ["Margherita Pizza"], price: 13.33 },
      { name: "بيتزا ببروني صغيرة", description: "صوص بيتزا مع ببروني وجبنة وخضرة", categories: ["Pepperoni Pizza"], price: 6.66 },
      { name: "بيتزا ببروني وسط", description: "صوص بيتزا مع ببروني وجبنة وخضرة", categories: ["Pepperoni Pizza"], price: 11.11 },
      { name: "بيتزا ببروني كبيرة", description: "صوص بيتزا مع ببروني وجبنة وخضرة", categories: ["Pepperoni Pizza"], price: 16.66 },
    ],
  },
];

const categoryByName = new Map();
const products = [];

for (const chunk of chunks) {
  for (const cat of chunk.categories) {
    if (!categoryByName.has(cat.name)) {
      categoryByName.set(cat.name, {
        name: cat.name,
        nameAr: cat.name_ar,
        sortOrder: cat.order,
      });
    }
  }
  for (const item of chunk.items) {
    const categoryName = item.categories[0];
    products.push({
      name: item.name,
      nameAr: item.name,
      description: null,
      descriptionAr: item.description,
      price: item.price,
      categoryName,
    });
  }
}

const categories = [...categoryByName.values()].sort(
  (a, b) => a.sortOrder - b.sortOrder,
);

const catalog = {
  merchantId: MERCHANT_ID,
  categories,
  products,
};

fs.writeFileSync(outPath, `${JSON.stringify(catalog, null, 2)}\n`, "utf8");
console.log(`Wrote ${outPath}`);
console.log(`  Categories: ${categories.length}`);
console.log(`  Products:   ${products.length}`);
