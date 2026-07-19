/**
 * One-shot generator: builds scripts/data/manqoushe.json from the bakery menu.
 * Prices are stored as USD (1 USD = 90,000 LBP), matching other catalogs.
 *
 * Run: node scripts/generate-manqoushe-catalog.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outPath = path.join(__dirname, "data", "manqoushe.json");

const LBP_PER_USD = 90000;
const lbp = (n) => Math.round((n / LBP_PER_USD) * 100) / 100;

function p(name, nameAr, priceLbp, categoryName) {
  return {
    name,
    nameAr,
    description: null,
    descriptionAr: null,
    price: lbp(priceLbp),
    categoryName,
  };
}

const SIZE_EN = {
  Small: "Small",
  Medium: "Medium",
  Large: "Large",
  Family: "Family",
};
const SIZE_AR = {
  Small: "صغير",
  Medium: "وسط",
  Large: "كبير",
  Family: "عائلي",
};

function sized(baseEn, baseAr, sizes, categoryName) {
  return Object.entries(sizes).map(([size, priceLbp]) =>
    p(
      `${baseEn} (${SIZE_EN[size]})`,
      `${baseAr} (${SIZE_AR[size]})`,
      priceLbp,
      categoryName,
    ),
  );
}

function variant(baseEn, baseAr, labelEn, labelAr, priceLbp, categoryName) {
  return p(
    `${baseEn} (${labelEn})`,
    `${baseAr} (${labelAr})`,
    priceLbp,
    categoryName,
  );
}

const categories = [
  { name: "Manqoushe", nameAr: "منقوش", sortOrder: 1 },
  { name: "Safaieh", nameAr: "صفايح", sortOrder: 2 },
  { name: "Pizza", nameAr: "بيتزا", sortOrder: 3 },
  { name: "Kaake", nameAr: "كعكة", sortOrder: 4 },
  { name: "Soiree", nameAr: "سواريه", sortOrder: 5 },
  { name: "Drinks", nameAr: "مشروبات", sortOrder: 6 },
];

const manqoushe = [
  ["Zaatar", "زعتر", 70000],
  ["Zaatar with Vegetables", "زعتر مع خضار", 120000],
  ["Zaatar Topped with Cheese", "زعتر على وجه جبنه", 150000],
  ["Zaatar Vegetables Cheese", "زعتر خضار جبنه", 170000],
  ["Half Zaatar Half Cheese", "نص زعتر نص جبنه", 150000],
  ["Cheese", "جبنه", 200000],
  ["Mozzarella Cheese", "جبنه موزيرلا", 250000],
  ["Cheese Vegetables Sausage", "جبنه خضار سجق", 250000],
  ["Cheese Sausage", "جبنه سجق", 300000],
  ["Cheese Pepperoni", "جبنه ببيروني", 240000],
  ["Cheese Mortadella", "جبنه مرتادل", 240000],
  ["Qareesh", "قريش", 180000],
  ["Qareesh Cheese", "قريش جبنه", 230000],
  ["Turkey", "تركيه", 220000],
  ["Meat", "لحمه", 200000],
  ["Meat Cheese", "لحمه جبنه", 250000],
  ["Labneh Vegetables", "لبنه خضار", 250000],
  ["Labneh Vegetables Mortadella", "لبنه خضار مرتدل", 300000],
  ["Mixed", "مشكله", 300000],
  ["Cheese and Turkey", "جبنة و حبش", 270000],
  ["Sliced Cheese", "جبنة مشروحة", 270000],
  ["Small Cheese", "جبنة صغيرة", 100000],
  ["Cheese with Sliced Arish", "جبنة مع اريش مشروحة", 300000],
  ["Cheese with Extra Turkey", "جبنة مع حبش اكسترا", 340000],
  ["Cheese with Greens", "جبن مع خضرة", 240000],
  ["Cheese Vegetables Mortadella", "جبنه خضار مارتاديلا", 290000],
  ["Tawook Cheese", "جبنة طاووق", 300000],
  ["Zaatar with Cheese and Greens", "زعتر مع جبنة و خضرة", 170000],
  ["Cheese and Corn", "جبنة و ذرة", 220000],
  ["Harhoura", "حرحورة", 240000],
  ["Small Bread", "خبز صغير", 20000],
  ["Sliced Zaatar", "زعتر مشروحة", 120000],
  ["Fajita Manqoushe", "منقوشة فاهيتا", 300000],
  ["Duplex Manqoushe", "منقوشة دوبلكس", 240000],
  ["Mortadella and Turkey", "مارتاديلا وحبش", 200000],
  ["Mortadella and Pepperoni", "مارتاديلا و بيبيروني", 200000],
  ["Half Sausage Half Fajita", "نص سجق نص فاهيتا", 300000],
  ["Half Pepperoni Half Mortadella", "نص بيبيروني نص مارتاديلا", 260000],
  ["Half Arish Half Cheese", "نص أريش نص جبنة", 200000],
  ["Sliced Fajita Manqoushe", "منقوشة فاهيتا مشروحة", 500000],
  ["Half Tawook Half Sausage", "نص طاووق نص سجق", 300000],
  ["Labneh without Vegetables", "لبنة بلا خضرة", 200000],
  ["4 Cheese Manqoushe", "منقوشة 4 cheese", 250000],
  ["Sliced Meat with Cheese", "لحمة مع جبنة مشروحة", 400000],
  ["Sliced Meat", "لحمة مشروحة", 300000],
  ["Labneh Mortadella", "لبنة مارتاديل", 250000],
  ["Labneh with Turkey", "لبنة مع حبش", 270000],
  ["Duplex Cheese", "جبنة دوبلكس", 300000],
  ["Extra Cheese", "جبنة اكسترا", 235000],
].map(([en, ar, price]) => p(en, ar, price, "Manqoushe"));

const safaieh = [
  ["Meat Safaieh", "صفايح لحمة", 130000],
  ["Sausage Safaieh", "صفايح سجق", 150000],
  ["Kefta Safaieh", "صفايح كفتة", 200000],
  ["Tripoli Safihe", "صفيحة طرابلسية", 70000],
].map(([en, ar, price]) => p(en, ar, price, "Safaieh"));

const pizzaDefs = [
  ["Vegetable Pizza", "بيتزا خضار", { Small: 450000, Medium: 700000, Large: 950000, Family: 1200000 }],
  ["Pepperoni Pizza", "بيتزا بيبيروني", { Small: 550000, Medium: 800000, Large: 1050000, Family: 1300000 }],
  ["Turkey Pizza", "بيتزا حبش", { Small: 550000, Medium: 650000, Large: 900000, Family: 1200000 }],
  ["Sausage Pizza", "بيتزا سجق", { Small: 500000, Medium: 750000, Large: 900000, Family: 1200000 }],
  ["Mortadella Pizza", "بيتزا مارتاديل", { Small: 500000, Medium: 750000, Large: 1000000, Family: 1250000 }],
  ["Fajita Pizza", "بيتزا فاهيتا", { Small: 600000, Medium: 850000, Large: 1100000, Family: 1350000 }],
  ["Margherita Pizza", "بيتزا ماركاريتا", { Small: 450000, Medium: 700000, Large: 950000, Family: 1200000 }],
  ["Half Pepperoni Half Vegetables", "نص بيبيروني نص خضار", { Small: 500000, Medium: 750000, Large: 1000000, Family: 1250000 }],
  ["Half Mortadella Half Turkey", "نص مارتاديلا نص حبش", { Small: 550000, Medium: 800000, Large: 1050000, Family: 1300000 }],
  ["Mixed Pizza", "بيتزا مشكلة", { Small: 550000, Medium: 700000, Large: 1100000, Family: 1450000 }],
  ["Mexicana Pizza", "بيتزا مكسيكانا", { Small: 600000, Medium: 850000, Large: 1100000, Family: 1350000 }],
  ["Half Sausage Half Mexicana", "نص سجق نص ميكسيكانا", { Small: 600000, Medium: 850000, Large: 1100000, Family: 1350000 }],
  ["Half Sausage Half Tawook", "نص سجق نص طاووق", { Small: 600000, Medium: 850000, Large: 1100000, Family: 1350000 }],
  ["Half Sausage Half Mortadella", "نص سجق نص مارتاديلا", { Small: 550000, Medium: 800000, Large: 1050000, Family: 1300000 }],
  ["Half Sausage Half Margherita", "نص سجق نص مارغاريتا", { Small: 550000, Medium: 800000, Large: 1050000, Family: 1300000 }],
  ["Half Turkey Half Pepperoni", "نص حبش نص بيبيروني", { Small: 550000, Medium: 800000, Large: 1050000, Family: 1300000 }],
  ["Half Turkey Half Tawook", "نص حبش نص طاووق", { Small: 550000, Medium: 800000, Large: 1050000, Family: 1300000 }],
  ["Half Turkey Half Margherita", "نص حبش نص مارغاريتا", { Small: 500000, Medium: 750000, Large: 1000000, Family: 1250000 }],
  ["Half Turkey Half BBQ", "نص حبش نص باربكيو", { Small: 550000, Medium: 800000, Large: 1050000, Family: 1300000 }],
  ["Half Turkey Half Mexicana", "نص حبش نص ماكسيكانا", { Small: 550000, Medium: 800000, Large: 1050000, Family: 1300000 }],
  ["Half Fajita Half Sausage", "نص فاهيتا نص سجق", { Small: 600000, Medium: 850000, Large: 1100000, Family: 1350000 }],
  ["Half Fajita Half Turkey", "نص فاهيتا نص حبش", { Small: 550000, Medium: 800000, Large: 1050000, Family: 1300000 }],
  ["Half Fajita Half BBQ", "نص فاهيتا نص باربكيو", { Small: 600000, Medium: 850000, Large: 1100000, Family: 1350000 }],
  ["Half Fajita Half Mortadella", "نص فاهيتا نص مارتاديلا", { Small: 550000, Medium: 800000, Large: 1050000, Family: 1300000 }],
  ["Half Fajita Half Margherita", "نص فاهيتا نص مارغاريتا", { Small: 550000, Medium: 800000, Large: 1050000, Family: 1300000 }],
  ["Half Fajita Half Mexicana", "نص فاهيتا نص ماكسيكانا", { Small: 600000, Medium: 850000, Large: 1100000, Family: 1350000 }],
  ["Half Sausage Half Turkey", "نص سجق نص حبش", { Small: 550000, Medium: 800000, Large: 1050000, Family: 1300000 }],
  ["Half Fajita Half Pepperoni", "نص فاهيتا نص بيبيروني", { Small: 550000, Medium: 800000, Large: 1050000, Family: 1300000 }],
  ["Half Fajita Half Tawook", "نص فاهيتا نص طاووق", { Small: 600000, Medium: 850000, Large: 1100000, Family: 1350000 }],
  ["Half Sausage Half Pepperoni", "نص سجق نص بيبيروني", { Small: 550000, Medium: 800000, Large: 1050000, Family: 1300000 }],
  ["Half Sausage Half BBQ", "نص سجق نص باربيكيو", { Small: 600000, Medium: 850000, Large: 1100000, Family: 1350000 }],
  ["Half BBQ Half Pepperoni", "نص باربكيو نص بيبيروني", { Small: 550000, Medium: 800000, Large: 1050000, Family: 1300000 }],
  ["Half BBQ Half Mortadella", "نص باربيكيو نص مارتاديل", { Small: 550000, Medium: 800000, Large: 1050000, Family: 1300000 }],
  ["Half BBQ Half Tawook", "نص باربكيو نص طاووق", { Small: 600000, Medium: 850000, Large: 1100000, Family: 1350000 }],
  ["Half Pepperoni Half Mexicana", "نص بيبيروني نص مكسيكان", { Small: 550000, Medium: 800000, Large: 1050000, Family: 1300000 }],
  ["Half Pepperoni Half Margherita", "نص بيبيروني نص ماغاريتا", { Small: 500000, Medium: 750000, Large: 1000000, Family: 1250000 }],
  ["Half Pepperoni Half Tawook", "نص بيبيروني نص طاووق", { Small: 550000, Medium: 800000, Large: 1050000, Family: 1300000 }],
  ["Half Pepperoni Half Mortadella", "نص بيبيروني نص مارتاديلا", { Small: 500000, Medium: 750000, Large: 1000000, Family: 1250000 }],
  ["Half BBQ Half Margherita", "نص باربكيو نص مارغاريتا", { Small: 550000, Medium: 800000, Large: 1050000, Family: 1300000 }],
  ["Half BBQ Half Mexicana", "نص باربكيو نص ماكسيكان", { Small: 600000, Medium: 850000, Large: 1100000, Family: 1350000 }],
  ["Half Vegetables Half Tawook", "نص خضرة نص طاووق", { Small: 550000, Medium: 800000, Large: 1050000, Family: 1300000 }],
  ["Half Vegetables Half Mortadella", "نص خضرة نص مارتاديل", { Small: 500000, Medium: 750000, Large: 1000000, Family: 1250000 }],
  ["Half Vegetables Half Margherita", "نص خضرة نص مارغاريتا", { Small: 450000, Medium: 700000, Large: 950000, Family: 1200000 }],
  ["Half Vegetables Half Mexicana", "نص خضرة نص ماكسيكان", { Small: 550000, Medium: 800000, Large: 1050000, Family: 1300000 }],
  ["Half Vegetables Half Fajita", "نص خضرة نص فاهيتا", { Small: 550000, Medium: 800000, Large: 1050000, Family: 1300000 }],
  ["Half Vegetables Half Sausage", "نص خضرة نص سجق", { Small: 550000, Medium: 800000, Large: 1050000, Family: 1300000 }],
  ["Half Vegetables Half Turkey", "نص خضرة نص حبش", { Small: 500000, Medium: 750000, Large: 1000000, Family: 1250000 }],
  ["Half Vegetables Half BBQ", "نص خضرة نص باربكيو", { Small: 550000, Medium: 800000, Large: 1050000, Family: 1300000 }],
  ["Half Tawook Half Margherita", "نص طاووق نص مارغاريتا", { Small: 550000, Medium: 800000, Large: 1050000, Family: 1300000 }],
  ["Half Tawook Half Mortadella", "نص طاووق نص مارتاديل", { Small: 550000, Medium: 800000, Large: 1050000, Family: 1300000 }],
  ["Half Mortadella Half Mexicana", "نص مارتاديل نص ماكسيكان", { Small: 550000, Medium: 800000, Large: 1050000, Family: 1300000 }],
  ["Half Margherita Half Mexicana", "نص مارغاريتا نص ماكسيكان", { Small: 550000, Medium: 800000, Large: 1050000, Family: 1300000 }],
  ["Half Tawook Half Mexicana", "نص طاووق نص ماكسيكان", { Small: 600000, Medium: 850000, Large: 1100000, Family: 1350000 }],
  ["Half Mortadella Half Margherita", "نص مارتاديل نص مارغاريتا", { Small: 500000, Medium: 750000, Large: 1000000, Family: 1250000 }],
  ["4 Cheese Pizza", "بيتزا 4 cheese", { Small: 550000, Medium: 800000, Large: 1050000, Family: 1300000 }],
  ["Tawook Pizza", "بيتزا طاووق", { Small: 600000, Medium: 850000, Large: 1100000, Family: 1350000 }],
  ["Half Turkey Half Mortadella", "نص حبش نص مارتاديلا", { Small: 500000, Medium: 750000, Large: 1000000, Family: 1250000 }],
];

const pizza = pizzaDefs.flatMap(([en, ar, sizes]) =>
  sized(en, ar, sizes, "Pizza"),
);

const kaake = [
  ["Regular Kaake", "كعكة عادية", 200000],
  ["Extra Cheese Kaake", "كعكة اكسترا جبنة", 250000],
  ["Turkey Kaake", "كعكة حبش", 270000],
  ["Sausage Kaake", "كعكة سجق", 270000],
  ["Mortadella Kaake", "كعكة مارتاديل", 240000],
  ["Fajita Kaake", "كعكة فاهيتا", 300000],
  ["Vegetable Kaake", "كعكة خضار", 240000],
  ["Extra Puffed Kaake", "كعكة منفوخة اكسترا", 235000],
  ["Regular Puffed Kaake", "كعكة منفوخة عادي", 200000],
  ["Pepperoni Kaake", "كعكة بيبيروني", 270000],
  ["Tripoli 4 Cheese Kaake", "كعكة طرابلسية 4 cheese", 240000],
  ["Puffed 4 Cheese Kaake", "كعكة منفوخة 4 cheese", 240000],
  ["Extra Cheese and Corn Kaake", "كعكة جبنة و ذرة اكسترا", 270000],
  ["Mozzarella Kaake", "كعكة موزاريلا", 250000],
  ["Mortadella and Greens Kaake", "كعكة مرتاديلا وخضرة", 300000],
  ["Labneh and Mortadella Kaake", "كعكة لبنة ومارتاديلا", 250000],
  ["Empty Kaak", "كعك فاضي", 30000],
  ["Samaa Kaak", "كعك سماء", 35000],
  ["Zaatar Kaak", "كعك زعتر", 70000],
  ["Extra Greens Kaake", "كعكة خضرة اكسترا", 250000],
  ["Cheese and Corn Kaake", "كعكة جبنة وذرة", 220000],
].map(([en, ar, price]) => p(en, ar, price, "Kaake"));

const soiree = [
  variant("Soiree Pizza", "سواريه بيتزا", "Dozen", "دزينة", 550000, "Soiree"),
  variant("Soiree Pizza", "سواريه بيتزا", "Piece", "قطعة", 45000, "Soiree"),
  variant("Soiree Zaatar", "سواريه زعتر", "Dozen", "دزينة", 350000, "Soiree"),
  variant("Soiree Zaatar", "سواريه زعتر", "Piece", "قطعة", 30000, "Soiree"),
  variant("Baalbakiye", "بعلبكية", "Dozen", "دزينة", 600000, "Soiree"),
  variant("Baalbakiye", "بعلبكية", "Piece", "قطعة", 50000, "Soiree"),
  variant("Arish", "أريش", "Dozen", "دزينة", 600000, "Soiree"),
  variant("Arish", "أريش", "Piece", "قطعة", 45000, "Soiree"),
  variant("Fajita Raqaqat", "رقاقات فهيتا", "Dozen", "دزينة", 800000, "Soiree"),
  variant("Fajita Raqaqat", "رقاقات فهيتا", "Piece", "قطعة", 70000, "Soiree"),
  p("Mixed Dozen", "دزدينة مشكل", 500000, "Soiree"),
  p("Spinach", "سبانغ", 400000, "Soiree"),
  p("Arish Pie", "فطيرة اريش", 50000, "Soiree"),
  p("Fajita Pie", "فطيرة فاهيتا", 150000, "Soiree"),
  p("Mexicana Pie", "فطيرة مكسيكانا", 150000, "Soiree"),
  p("Meat in Dough Dozen", "دزدينة لحمة بالعجين", 1560000, "Soiree"),
  p("Small Pull Dough", "عجينة سحب صغيرة", 35000, "Soiree"),
  p("Regular Pull Dough", "عجينة سحب عادية", 45000, "Soiree"),
  p("Small Dough No Toppings", "عجينة صغيرة بلا اضافات", 15000, "Soiree"),
  p("Regular Dough", "عجينة عادية", 25000, "Soiree"),
  p("Optional Soiree Dozen", "دزدينة سواري اختياري", 550000, "Soiree"),
  p("Meat in Dough Disc", "قرص لحمة بالعجين", 130000, "Soiree"),
  p("Soiree Piece", "سواريه قطعة", 42000, "Soiree"),
  variant("Soiree Cheese", "جبنة", "Dozen", "دزينة", 550000, "Soiree"),
  variant("Soiree Cheese", "جبنة", "Piece", "قطعة", 45000, "Soiree"),
  p("Cheese and Zaatar Dozen", "جبنة و زعتر", 450000, "Soiree"),
  p("Small Meat in Dough", "لحمة بعجين صغير", 45000, "Soiree"),
  p("Shaibiyat", "شعيبيات", 70000, "Soiree"),
  p("Shaibiyat Dozen", "دزدينة شعيبيات", 840000, "Soiree"),
];

const drinks = [
  ["Water", "مياه", 25000],
  ["Mr Juicy", "مستر جوسي", 20000],
  ["Small Soft Drink Can", "مشروب غازي تنك صغير", 50000],
  ["Large Soft Drink Can", "مشروب غازي تنك كبير", 70000],
  ["Soft Drink Bottle", "مشروب غازي قنينة", 60000],
  ["Extra Juice", "عصير اكسترا", 50000],
  ["Soft Drink 1.25L", "مشروب غازي 1.25", 120000],
  ["Large Water", "مياه كبير", 40000],
].map(([en, ar, price]) => p(en, ar, price, "Drinks"));

const catalog = {
  merchantId: "c8c82cf1-b87b-4ab9-bf18-1bea26870c7e",
  merchantName: "Manqoushe",
  categories,
  products: [...manqoushe, ...safaieh, ...pizza, ...kaake, ...soiree, ...drinks],
};

fs.writeFileSync(outPath, JSON.stringify(catalog, null, 2) + "\n", "utf8");

const byCat = {};
for (const prod of catalog.products) {
  byCat[prod.categoryName] = (byCat[prod.categoryName] ?? 0) + 1;
}
console.log(`Wrote ${outPath}`);
console.log(`Products: ${catalog.products.length}`);
console.log(byCat);

