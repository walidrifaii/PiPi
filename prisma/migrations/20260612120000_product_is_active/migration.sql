-- Add product visibility flag for merchant dashboard (v2 storefront hides inactive products).
ALTER TABLE "products" ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX "products_is_active_idx" ON "products"("is_active");
