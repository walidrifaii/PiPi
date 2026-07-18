-- Drop per-product sale price; storefront discounts use merchant offers instead.
ALTER TABLE "products" DROP COLUMN IF EXISTS "discount_price";
