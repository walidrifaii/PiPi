/** Visual style per supermarket category name (Arabic). */
export const CATEGORY_IMAGE_STYLES = {
  "المثلجات والبوظة": { emoji: "1f366", from: "#7DD3FC", to: "#38BDF8" },
  "الخبز والمخبوزات": { emoji: "1f35e", from: "#FCD34D", to: "#F59E0B" },
  "الأرز والحبوب": { emoji: "1f35a", from: "#FDE68A", to: "#D97706" },
  "البقوليات والبرغل": { emoji: "1fad8", from: "#86EFAC", to: "#16A34A" },
  "المعكرونة والنودلز": { emoji: "1f35d", from: "#FDBA74", to: "#EA580C" },
  "الطحين والسكر والملح": { emoji: "1f370", from: "#F5F5F4", to: "#D6D3D1" },
  "البهارات والأعشاب والشوربات": { emoji: "1f336", from: "#FCA5A5", to: "#DC2626" },
  "الزيوت والسمن والزبدة": { emoji: "1f9c8", from: "#FEF08A", to: "#CA8A04" },
  "الحليب ومكونات الحلويات": { emoji: "1f95b", from: "#E0E7FF", to: "#6366F1" },
  "الأجبان والكريمة": { emoji: "1f9c0", from: "#FEF3C7", to: "#F59E0B" },
  "المعلبات والخضار المحفوظة": { emoji: "1f96b", from: "#BBF7D0", to: "#059669" },
  "المرتديلا واللحوم المعلبة": { emoji: "1f969", from: "#FECACA", to: "#B91C1C" },
  "التونة والسردين": { emoji: "1f41f", from: "#93C5FD", to: "#2563EB" },
  "الصلصات والتتبيلات": { emoji: "1fad2", from: "#FCA5A5", to: "#C2410C" },
  "المخللات والزيتون": { emoji: "1fad9", from: "#A3E635", to: "#4D7C0F" },
  "المربى والسبريد والحلاوة والطحينة": { emoji: "1f36f", from: "#FDE047", to: "#A16207" },
  "البسكويت والويفر والكيك": { emoji: "1f36a", from: "#FBCFE8", to: "#DB2777" },
  "الشوكولا والحلويات": { emoji: "1f36b", from: "#D97706", to: "#78350F" },
  "العلكة والبونبون والجيلي": { emoji: "1f36c", from: "#F0ABFC", to: "#A21CAF" },
  "الشيبس والسناكات المالحة": { emoji: "1f954", from: "#FDBA74", to: "#C2410C" },
  "المكسرات والبزر": { emoji: "1f330", from: "#D6B48A", to: "#92400E" },
  "العصائر": { emoji: "1f9c3", from: "#FDE68A", to: "#EA580C" },
  "المشروبات الغازية": { emoji: "1f964", from: "#BFDBFE", to: "#1D4ED8" },
  "مشروبات الطاقة": { emoji: "26a1", from: "#FEF08A", to: "#CA8A04" },
  "المياه": { emoji: "1f4a7", from: "#BAE6FD", to: "#0284C7" },
  "القهوة والشاي والمشروبات الساخنة": { emoji: "2615", from: "#D6D3D1", to: "#57534E" },
  "المجمدات": { emoji: "1f9ca", from: "#A5F3FC", to: "#0891B2" },
  "المنظفات والمعطرات المنزلية": { emoji: "1f9f4", from: "#C4B5FD", to: "#6D28D9" },
  "أدوات التنظيف المنزلية": { emoji: "1f9f9", from: "#93C5FD", to: "#1D4ED8" },
  "المبيدات الحشرية": { emoji: "1f41c", from: "#86EFAC", to: "#15803D" },
  "المحارم والورقيات": { emoji: "1f9fb", from: "#F5F5F4", to: "#A8A29E" },
  "الأكياس والتغليف": { emoji: "1f6cd", from: "#FDE68A", to: "#B45309" },
  "مستلزمات السفرة": { emoji: "1f374", from: "#E5E7EB", to: "#6B7280" },
  "العناية بالشعر": { emoji: "1f487", from: "#FBCFE8", to: "#BE185D" },
  "الصابون والاستحمام": { emoji: "1f9fc", from: "#BAE6FD", to: "#0369A1" },
  "مزيلات العرق والعطور": { emoji: "1f9f4", from: "#DDD6FE", to: "#7C3AED" },
  "العناية الشخصية والصحية": { emoji: "1f9fc", from: "#A7F3D0", to: "#047857" },
  "العناية بالفم والأسنان": { emoji: "1f9b7", from: "#E0F2FE", to: "#0284C7" },
  "الفوط الصحية": { emoji: "1f6c1", from: "#FBCFE8", to: "#DB2777" },
  "حفاضات الأطفال": { emoji: "1f476", from: "#BFDBFE", to: "#2563EB" },
  "الحلاقة": { emoji: "1fa92", from: "#CBD5E1", to: "#475569" },
  "الدخان والمعسل ولوازمه": { emoji: "1f6ac", from: "#D4D4D8", to: "#52525B" },
  "الفحم ولوازم النرجيلة": { emoji: "1fa93", from: "#57534E", to: "#1C1917" },
  "الألعاب": { emoji: "1f3ae", from: "#F0ABFC", to: "#9333EA" },
  "القرطاسية": { emoji: "1f4dd", from: "#FDE68A", to: "#B45309" },
  "البطاريات واللوازم الكهربائية": { emoji: "1f50b", from: "#86EFAC", to: "#15803D" },
  "البيض": { emoji: "1f95a", from: "#FFEDD5", to: "#EA580C" },
  "متفرقات منزلية": { emoji: "1f3e0", from: "#E5E7EB", to: "#64748B" },
};

export function slugifyCategoryName(name) {
  return String(name)
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\p{L}\p{N}-]+/gu, "")
    .slice(0, 80);
}

export function defaultStyleForCategory(name, index) {
  const palette = [
    ["#BAE6FD", "#0284C7"],
    ["#BBF7D0", "#059669"],
    ["#FDE68A", "#D97706"],
    ["#FBCFE8", "#DB2777"],
    ["#DDD6FE", "#7C3AED"],
    ["#FECACA", "#DC2626"],
  ];
  const [from, to] = palette[index % palette.length];
  return { emoji: "1f6d2", from, to };
}
