CREATE TABLE "earnings_settlements" (
    "id" UUID NOT NULL,
    "participant_type" VARCHAR(20) NOT NULL,
    "driver_id" UUID,
    "merchant_id" UUID,
    "reference_code" VARCHAR(32) NOT NULL,
    "period_from" TIMESTAMP(3) NOT NULL,
    "period_to" TIMESTAMP(3) NOT NULL,
    "gross_amount" DECIMAL(12,2) NOT NULL,
    "net_amount" DECIMAL(12,2) NOT NULL,
    "platform_fee" DECIMAL(12,2) NOT NULL,
    "order_count" INTEGER NOT NULL,
    "order_ids" JSONB NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'PAID',
    "paid_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "earnings_settlements_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "earnings_settlements_reference_code_key" ON "earnings_settlements"("reference_code");
CREATE INDEX "earnings_settlements_driver_id_status_idx" ON "earnings_settlements"("driver_id", "status");
CREATE INDEX "earnings_settlements_merchant_id_status_idx" ON "earnings_settlements"("merchant_id", "status");
CREATE INDEX "earnings_settlements_paid_at_idx" ON "earnings_settlements"("paid_at");

ALTER TABLE "earnings_settlements" ADD CONSTRAINT "earnings_settlements_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "drivers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "earnings_settlements" ADD CONSTRAINT "earnings_settlements_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "merchants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
