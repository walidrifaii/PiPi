-- Pickup courier module: settings, schedule, fees, blocked polygons, orders.

CREATE TABLE "pickup_settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "timezone" VARCHAR(64) NOT NULL DEFAULT 'Africa/Tripoli',
    "now_min_minutes" INTEGER NOT NULL DEFAULT 35,
    "now_max_minutes" INTEGER NOT NULL DEFAULT 60,
    "service_fee" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pickup_settings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "pickup_schedule_slots" (
    "id" UUID NOT NULL,
    "weekday" INTEGER NOT NULL,
    "start_local" VARCHAR(5) NOT NULL,
    "end_local" VARCHAR(5) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pickup_schedule_slots_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "pickup_schedule_slots_weekday_is_active_idx"
    ON "pickup_schedule_slots"("weekday", "is_active");

CREATE TABLE "pickup_delivery_fee_configs" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100),
    "fixed_fee" DECIMAL(12,2) NOT NULL,
    "included_km" DECIMAL(8,2) NOT NULL DEFAULT 10,
    "km_unit" DECIMAL(8,2) NOT NULL DEFAULT 1,
    "fee_per_unit" DECIMAL(12,2) NOT NULL,
    "max_fee" DECIMAL(12,2) NOT NULL,
    "max_km" DECIMAL(8,2) NOT NULL DEFAULT 30,
    "sample_breakdown" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pickup_delivery_fee_configs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "pickup_delivery_fee_configs_is_active_sort_order_idx"
    ON "pickup_delivery_fee_configs"("is_active", "sort_order");

CREATE TABLE "pickup_blocked_zones" (
    "id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "applies_to" VARCHAR(10) NOT NULL DEFAULT 'BOTH',
    "boundary_geo_json" JSONB NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "reason" VARCHAR(255),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pickup_blocked_zones_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "pickup_blocked_zones_is_active_applies_to_idx"
    ON "pickup_blocked_zones"("is_active", "applies_to");

CREATE TABLE "pickup_orders" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "driver_id" UUID,
    "method" VARCHAR(20) NOT NULL,
    "status" VARCHAR(50) NOT NULL,
    "description" TEXT NOT NULL,
    "declared_value" DECIMAL(10,2) NOT NULL,
    "service_fee" DECIMAL(10,2) NOT NULL,
    "delivery_fee" DECIMAL(10,2) NOT NULL,
    "total" DECIMAL(10,2) NOT NULL,
    "distance_km" DECIMAL(8,3) NOT NULL,
    "pickup_ref" VARCHAR(191),
    "from_address_line" VARCHAR(500) NOT NULL,
    "from_latitude" DECIMAL(10,7) NOT NULL,
    "from_longitude" DECIMAL(10,7) NOT NULL,
    "from_address_id" UUID,
    "to_address_line" VARCHAR(500) NOT NULL,
    "to_latitude" DECIMAL(10,7) NOT NULL,
    "to_longitude" DECIMAL(10,7) NOT NULL,
    "to_address_id" UUID,
    "scheduled_at" TIMESTAMP(3),
    "eta_min_minutes" INTEGER,
    "eta_max_minutes" INTEGER,
    "snapshot" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pickup_orders_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "pickup_orders_user_id_created_at_idx"
    ON "pickup_orders"("user_id", "created_at" DESC);
CREATE INDEX "pickup_orders_driver_id_status_idx"
    ON "pickup_orders"("driver_id", "status");
CREATE INDEX "pickup_orders_status_driver_id_idx"
    ON "pickup_orders"("status", "driver_id");
CREATE INDEX "pickup_orders_status_scheduled_at_idx"
    ON "pickup_orders"("status", "scheduled_at");

ALTER TABLE "pickup_orders"
    ADD CONSTRAINT "pickup_orders_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "pickup_orders"
    ADD CONSTRAINT "pickup_orders_driver_id_fkey"
    FOREIGN KEY ("driver_id") REFERENCES "drivers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "pickup_orders"
    ADD CONSTRAINT "pickup_orders_from_address_id_fkey"
    FOREIGN KEY ("from_address_id") REFERENCES "user_addresses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "pickup_orders"
    ADD CONSTRAINT "pickup_orders_to_address_id_fkey"
    FOREIGN KEY ("to_address_id") REFERENCES "user_addresses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "pickup_settings" (
    "id",
    "is_enabled",
    "timezone",
    "now_min_minutes",
    "now_max_minutes",
    "service_fee",
    "updated_at"
) VALUES (
    1,
    true,
    'Africa/Tripoli',
    35,
    60,
    0,
    CURRENT_TIMESTAMP
);

INSERT INTO "pickup_delivery_fee_configs" (
    "id",
    "name",
    "fixed_fee",
    "included_km",
    "km_unit",
    "fee_per_unit",
    "max_fee",
    "max_km",
    "sample_breakdown",
    "is_active",
    "sort_order",
    "updated_at"
) VALUES (
    gen_random_uuid(),
    'Pickup default',
    100,
    10,
    1,
    20,
    500,
    30,
    '{"fixedFee":100,"includedKm":10,"kmUnit":1,"feePerUnit":20,"maxFee":500,"maxKm":30,"deliveryFee":100}'::jsonb,
    true,
    0,
    CURRENT_TIMESTAMP
);
