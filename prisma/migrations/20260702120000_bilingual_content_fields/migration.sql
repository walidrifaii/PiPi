-- Bilingual (en/ar) text columns for storefront entities.
-- Column-based i18n: no joins, indexable, best read performance for a fixed 2-locale app.

ALTER TABLE "merchants" ADD COLUMN "name_ar" VARCHAR(255);
ALTER TABLE "merchant_types" ADD COLUMN "name_ar" VARCHAR(255);
ALTER TABLE "merchant_types" ADD COLUMN "description_ar" TEXT;
ALTER TABLE "merchant_offers" ADD COLUMN "title_ar" VARCHAR(255);
ALTER TABLE "banners" ADD COLUMN "title" VARCHAR(255);
ALTER TABLE "banners" ADD COLUMN "title_ar" VARCHAR(255);

-- Prefix search on Arabic merchant names (storefront search).
CREATE INDEX "merchants_name_ar_idx" ON "merchants" ("name_ar");
