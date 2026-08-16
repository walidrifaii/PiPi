-- List endpoints ORDER BY created_at DESC. CONCURRENTLY avoids locking
-- writes on production while the indexes build.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "orders_merchant_id_created_at_idx"
ON "orders"("merchant_id", "created_at" DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS "orders_user_id_created_at_idx"
ON "orders"("user_id", "created_at" DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS "orders_status_created_at_idx"
ON "orders"("status", "created_at" DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS "orders_merchant_id_status_created_at_idx"
ON "orders"("merchant_id", "status", "created_at" DESC);
