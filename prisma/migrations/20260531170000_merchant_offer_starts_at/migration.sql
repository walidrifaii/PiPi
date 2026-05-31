-- Offer promos have a visible window: starts_at through ends_at.
ALTER TABLE "merchant_offers" ADD COLUMN "starts_at" TIMESTAMP(3);

UPDATE "merchant_offers" SET "starts_at" = "created_at" WHERE "starts_at" IS NULL;

ALTER TABLE "merchant_offers" ALTER COLUMN "starts_at" SET NOT NULL;

DROP INDEX IF EXISTS "merchant_offers_is_active_ends_at_idx";

CREATE INDEX "merchant_offers_is_active_starts_at_ends_at_idx"
  ON "merchant_offers"("is_active", "starts_at", "ends_at");
