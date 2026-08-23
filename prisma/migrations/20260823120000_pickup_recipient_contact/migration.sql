-- Recipient contact for courier pickup orders (who receives the package).

ALTER TABLE "pickup_orders"
    ADD COLUMN "recipient_full_name" VARCHAR(191),
    ADD COLUMN "recipient_phone" VARCHAR(32);
