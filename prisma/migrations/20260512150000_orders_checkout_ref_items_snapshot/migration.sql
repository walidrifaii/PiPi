-- AlterTable
ALTER TABLE "orders" ADD COLUMN "checkout_ref" VARCHAR(191),
ADD COLUMN "items_snapshot" JSONB;
