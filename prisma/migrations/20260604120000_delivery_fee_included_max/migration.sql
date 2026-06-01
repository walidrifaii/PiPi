-- includedKm = flat radius for fixedFee; maxFee = cap on total delivery charge.

ALTER TABLE "delivery_fee_configs" ADD COLUMN IF NOT EXISTS "included_km" DECIMAL(8,2);
ALTER TABLE "delivery_fee_configs" ADD COLUMN IF NOT EXISTS "max_fee" DECIMAL(12,2);

UPDATE "delivery_fee_configs"
SET
  "included_km" = COALESCE("included_km", 10),
  "max_fee" = COALESCE("max_fee", GREATEST("fixed_fee", 15))
WHERE "included_km" IS NULL OR "max_fee" IS NULL;

ALTER TABLE "delivery_fee_configs" ALTER COLUMN "included_km" SET NOT NULL;
ALTER TABLE "delivery_fee_configs" ALTER COLUMN "included_km" SET DEFAULT 10;
ALTER TABLE "delivery_fee_configs" ALTER COLUMN "max_fee" SET NOT NULL;
ALTER TABLE "delivery_fee_configs" ALTER COLUMN "max_fee" SET DEFAULT 15;

UPDATE "delivery_fee_configs"
SET "sample_breakdown" = jsonb_build_object(
  'fixedFee', "fixed_fee",
  'includedKm', "included_km",
  'kmUnit', "km_unit",
  'feePerUnit', "fee_per_unit",
  'maxFee', "max_fee",
  'deliveryFee', LEAST(
    "max_fee",
    GREATEST(
      "fixed_fee",
      "fixed_fee" + GREATEST(
        0,
        CEIL(GREATEST(0, 5 - "included_km") / NULLIF("km_unit", 0)) * "fee_per_unit"
      )
    )
  )
);
