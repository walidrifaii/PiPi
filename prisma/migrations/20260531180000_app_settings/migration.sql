-- Platform key-value settings (driver delivery share, etc.)
CREATE TABLE "app_settings" (
    "key" VARCHAR(100) NOT NULL,
    "value" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "app_settings_pkey" PRIMARY KEY ("key")
);

INSERT INTO "app_settings" ("key", "value", "updated_at")
VALUES ('driver_delivery_fee_share_percent', '60', CURRENT_TIMESTAMP);

INSERT INTO "app_settings" ("key", "value", "updated_at")
VALUES ('merchant_food_share_percent', '100', CURRENT_TIMESTAMP);
