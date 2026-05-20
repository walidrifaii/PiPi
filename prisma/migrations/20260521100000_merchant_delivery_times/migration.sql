-- CreateTable
CREATE TABLE "merchant_delivery_times" (
    "id" UUID NOT NULL,
    "merchant_id" UUID NOT NULL,
    "min_minutes" INTEGER NOT NULL,
    "max_minutes" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "merchant_delivery_times_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "merchant_delivery_times_merchant_id_key" ON "merchant_delivery_times"("merchant_id");

-- AddForeignKey
ALTER TABLE "merchant_delivery_times" ADD CONSTRAINT "merchant_delivery_times_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "merchants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
