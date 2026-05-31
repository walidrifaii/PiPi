-- AlterTable
ALTER TABLE "merchant_offers" ADD COLUMN "ends_at" TIMESTAMP(3);

-- Backfill existing rows (if any) with 30 days from now
UPDATE "merchant_offers" SET "ends_at" = NOW() + INTERVAL '30 days' WHERE "ends_at" IS NULL;

ALTER TABLE "merchant_offers" ALTER COLUMN "ends_at" SET NOT NULL;

-- DropIndex
DROP INDEX IF EXISTS "merchant_offers_is_active_created_at_idx";

-- CreateIndex
CREATE INDEX "merchant_offers_is_active_ends_at_idx" ON "merchant_offers"("is_active", "ends_at");
