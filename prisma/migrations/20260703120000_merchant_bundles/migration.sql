-- CreateTable
CREATE TABLE "merchant_bundles" (
    "id" UUID NOT NULL,
    "merchant_id" UUID NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "title_ar" VARCHAR(255),
    "description" TEXT,
    "description_ar" TEXT,
    "price" DECIMAL(10,2) NOT NULL,
    "image_url" VARCHAR(500) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "merchant_bundles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "merchant_bundles_merchant_id_idx" ON "merchant_bundles"("merchant_id");

-- CreateIndex
CREATE INDEX "merchant_bundles_is_active_sort_order_idx" ON "merchant_bundles"("is_active", "sort_order");

-- AddForeignKey
ALTER TABLE "merchant_bundles" ADD CONSTRAINT "merchant_bundles_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "merchants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
