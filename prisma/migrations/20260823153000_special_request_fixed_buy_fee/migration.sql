-- Special Request: drop distance pricing and add a super-admin fixed buy fee.

ALTER TABLE "special_requests" DROP COLUMN IF EXISTS "distance_km";

ALTER TABLE "special_requests"
    ALTER COLUMN "delivery_fee" SET DEFAULT 0;

CREATE TABLE IF NOT EXISTS "special_request_settings" (
    "id" INTEGER NOT NULL,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "timezone" VARCHAR(64) NOT NULL DEFAULT 'Africa/Tripoli',
    "now_min_minutes" INTEGER NOT NULL DEFAULT 35,
    "now_max_minutes" INTEGER NOT NULL DEFAULT 60,
    "buy_fee" DECIMAL(10,2) NOT NULL DEFAULT 3,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "special_request_settings_pkey" PRIMARY KEY ("id")
);

INSERT INTO "special_request_settings" (
    "id",
    "is_enabled",
    "timezone",
    "now_min_minutes",
    "now_max_minutes",
    "buy_fee",
    "created_at",
    "updated_at"
)
VALUES (1, true, 'Africa/Tripoli', 35, 60, 3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
