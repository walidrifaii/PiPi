-- Normalized working hours: one row per open/close interval (local HH:mm in merchant.timezone).
CREATE TABLE "merchant_working_intervals" (
    "id" UUID NOT NULL,
    "merchant_id" UUID NOT NULL,
    "weekday" INTEGER NOT NULL,
    "open_local" VARCHAR(5) NOT NULL,
    "close_local" VARCHAR(5) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "merchant_working_intervals_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "merchant_working_intervals_merchant_id_idx" ON "merchant_working_intervals"("merchant_id");
CREATE INDEX "merchant_working_intervals_merchant_id_weekday_idx" ON "merchant_working_intervals"("merchant_id", "weekday");

ALTER TABLE "merchant_working_intervals" ADD CONSTRAINT "merchant_working_intervals_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "merchants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Copy existing JSON schedule into rows (best-effort; skips invalid shapes).
INSERT INTO "merchant_working_intervals" ("id", "merchant_id", "weekday", "open_local", "close_local", "sort_order", "created_at")
SELECT gen_random_uuid(),
       x."merchant_id",
       x."weekday",
       x."open_local",
       x."close_local",
       (ROW_NUMBER() OVER (PARTITION BY x."merchant_id", x."weekday" ORDER BY x."day_idx", x."intv_idx") - 1)::integer,
       CURRENT_TIMESTAMP
FROM (
    SELECT m."id" AS "merchant_id",
           (d."value"->>'weekday')::integer AS "weekday",
           TRIM(BOTH ' ' FROM (intv."value"->>'open')) AS "open_local",
           TRIM(BOTH ' ' FROM (intv."value"->>'close')) AS "close_local",
           d."day_idx",
           intv."intv_idx"
    FROM "merchants" m
    CROSS JOIN LATERAL jsonb_array_elements(COALESCE(m."working_hours_json"->'days', '[]'::jsonb))
        WITH ORDINALITY AS d("value", "day_idx")
    CROSS JOIN LATERAL jsonb_array_elements(COALESCE(d."value"->'intervals', '[]'::jsonb))
        WITH ORDINALITY AS intv("value", "intv_idx")
    WHERE m."working_hours_json" IS NOT NULL
      AND jsonb_typeof(m."working_hours_json"->'days') = 'array'
) x
WHERE x."weekday" BETWEEN 1 AND 7
  AND x."open_local" ~ '^([01]?[0-9]|2[0-3]):[0-5][0-9]$'
  AND x."close_local" ~ '^([01]?[0-9]|2[0-3]):[0-5][0-9]$';

ALTER TABLE "merchants" DROP COLUMN "working_hours_json";
