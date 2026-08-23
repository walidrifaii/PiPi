-- Shop-for-me jobs: buy an item from a store not listed in the app.

CREATE TABLE "special_requests" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "driver_id" UUID,
    "status" VARCHAR(50) NOT NULL,
    "store_name" VARCHAR(191) NOT NULL,
    "item_name" VARCHAR(191) NOT NULL,
    "product_image_url" VARCHAR(500) NOT NULL,
    "request_ref" VARCHAR(191),
    "service_fee" DECIMAL(10,2) NOT NULL,
    "delivery_fee" DECIMAL(10,2) NOT NULL,
    "total" DECIMAL(10,2) NOT NULL,
    "distance_km" DECIMAL(8,3) NOT NULL,
    "from_address_line" VARCHAR(500) NOT NULL,
    "from_latitude" DECIMAL(10,7) NOT NULL,
    "from_longitude" DECIMAL(10,7) NOT NULL,
    "from_address_id" UUID,
    "to_address_line" VARCHAR(500) NOT NULL,
    "to_latitude" DECIMAL(10,7) NOT NULL,
    "to_longitude" DECIMAL(10,7) NOT NULL,
    "to_address_id" UUID,
    "eta_min_minutes" INTEGER,
    "eta_max_minutes" INTEGER,
    "snapshot" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "special_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "special_requests_user_id_created_at_idx"
    ON "special_requests"("user_id", "created_at" DESC);
CREATE INDEX "special_requests_driver_id_status_idx"
    ON "special_requests"("driver_id", "status");
CREATE INDEX "special_requests_status_driver_id_idx"
    ON "special_requests"("status", "driver_id");

ALTER TABLE "special_requests"
    ADD CONSTRAINT "special_requests_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "special_requests"
    ADD CONSTRAINT "special_requests_driver_id_fkey"
    FOREIGN KEY ("driver_id") REFERENCES "drivers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "special_requests"
    ADD CONSTRAINT "special_requests_from_address_id_fkey"
    FOREIGN KEY ("from_address_id") REFERENCES "user_addresses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "special_requests"
    ADD CONSTRAINT "special_requests_to_address_id_fkey"
    FOREIGN KEY ("to_address_id") REFERENCES "user_addresses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
