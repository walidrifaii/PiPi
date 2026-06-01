-- CreateTable
CREATE TABLE "delivery_fee_configs" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100),
    "fixed_fee" DECIMAL(12,2) NOT NULL,
    "km_unit" DECIMAL(8,2) NOT NULL DEFAULT 1,
    "fee_per_unit" DECIMAL(12,2) NOT NULL,
    "sample_breakdown" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "delivery_fee_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "delivery_fee_configs_is_active_sort_order_idx" ON "delivery_fee_configs"("is_active", "sort_order");

INSERT INTO "delivery_fee_configs" (
    "id",
    "name",
    "fixed_fee",
    "km_unit",
    "fee_per_unit",
    "sample_breakdown",
    "is_active",
    "sort_order",
    "updated_at"
) VALUES (
    gen_random_uuid(),
    'Default',
    1.5,
    1,
    1,
    '{"fixedFee":1.5,"kmUnit":1,"feePerUnit":1,"deliveryFee":6.5}'::jsonb,
    true,
    0,
    CURRENT_TIMESTAMP
);
