-- Allow order lines for meal bundles (product_id optional when bundle_id is set).
ALTER TABLE "order_items" ALTER COLUMN "product_id" DROP NOT NULL;

ALTER TABLE "order_items" ADD COLUMN "bundle_id" UUID;

ALTER TABLE "order_items"
  ADD CONSTRAINT "order_items_bundle_id_fkey"
  FOREIGN KEY ("bundle_id") REFERENCES "merchant_bundles"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "order_items_bundle_id_idx" ON "order_items"("bundle_id");
