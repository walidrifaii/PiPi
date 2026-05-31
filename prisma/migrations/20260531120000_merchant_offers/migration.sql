-- CreateTable
CREATE TABLE "merchant_offers" (
    "id" UUID NOT NULL,
    "merchant_id" UUID NOT NULL,
    "title" VARCHAR(255),
    "discount_percent" DECIMAL(5,2) NOT NULL,
    "image_url" VARCHAR(500) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "merchant_offers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "merchant_offers_merchant_id_idx" ON "merchant_offers"("merchant_id");

-- CreateIndex
CREATE INDEX "merchant_offers_is_active_created_at_idx" ON "merchant_offers"("is_active", "created_at");

-- AddForeignKey
ALTER TABLE "merchant_offers" ADD CONSTRAINT "merchant_offers_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "merchants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
