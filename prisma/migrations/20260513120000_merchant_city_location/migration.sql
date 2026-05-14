-- AlterTable
ALTER TABLE "merchants" ADD COLUMN     "city_code" VARCHAR(64),
ADD COLUMN     "latitude" DECIMAL(10,7),
ADD COLUMN     "longitude" DECIMAL(10,7);

-- CreateIndex
CREATE INDEX "merchants_city_code_idx" ON "merchants"("city_code");
