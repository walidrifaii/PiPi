-- maxKm = distance cap for billing; trips longer than this pay the same as maxKm.

ALTER TABLE "delivery_fee_configs" ADD COLUMN IF NOT EXISTS "max_km" DECIMAL(8,2);

UPDATE "delivery_fee_configs"
SET "max_km" = COALESCE("max_km", 30)
WHERE "max_km" IS NULL;

ALTER TABLE "delivery_fee_configs" ALTER COLUMN "max_km" SET NOT NULL;
ALTER TABLE "delivery_fee_configs" ALTER COLUMN "max_km" SET DEFAULT 30;
