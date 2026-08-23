-- Keep one row per user+label (oldest wins); rename later duplicates so the unique index can be created.
WITH ranked AS (
    SELECT
        id,
        row_number() OVER (
            PARTITION BY user_id, lower(btrim(label))
            ORDER BY created_at ASC, id ASC
        ) AS rn
    FROM "user_addresses"
    WHERE label IS NOT NULL AND btrim(label) <> ''
)
UPDATE "user_addresses" AS ua
SET label = left(btrim(ua.label) || ' (' || ranked.rn || ')', 100)
FROM ranked
WHERE ua.id = ranked.id
  AND ranked.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS "user_addresses_user_id_label_lower_key"
    ON "user_addresses" (user_id, lower(btrim(label)))
    WHERE label IS NOT NULL AND btrim(label) <> '';
