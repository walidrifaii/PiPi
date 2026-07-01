-- CreateTable: coupons
CREATE TABLE "coupons" (
    "id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "discount_percent" DECIMAL(5,2) NOT NULL,
    "author_name" VARCHAR(255) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "expires_at" TIMESTAMP(3),
    "max_usages" INTEGER,
    "usage_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "coupons_pkey" PRIMARY KEY ("id")
);

-- CreateTable: coupon_usages
CREATE TABLE "coupon_usages" (
    "id" UUID NOT NULL,
    "coupon_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "discount_amount" DECIMAL(10,2) NOT NULL,
    "used_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coupon_usages_pkey" PRIMARY KEY ("id")
);

-- Add coupon columns to orders
ALTER TABLE "orders"
    ADD COLUMN "coupon_id" UUID,
    ADD COLUMN "coupon_code" VARCHAR(50),
    ADD COLUMN "coupon_discount" DECIMAL(10,2);

-- CreateIndex
CREATE UNIQUE INDEX "coupons_code_key" ON "coupons"("code");
CREATE INDEX "coupons_code_idx" ON "coupons"("code");
CREATE INDEX "coupons_is_active_expires_at_idx" ON "coupons"("is_active", "expires_at");

CREATE UNIQUE INDEX "coupon_usages_order_id_key" ON "coupon_usages"("order_id");
CREATE UNIQUE INDEX "coupon_usages_coupon_id_user_id_key" ON "coupon_usages"("coupon_id", "user_id");
CREATE INDEX "coupon_usages_coupon_id_idx" ON "coupon_usages"("coupon_id");
CREATE INDEX "coupon_usages_user_id_idx" ON "coupon_usages"("user_id");

CREATE INDEX "orders_coupon_id_idx" ON "orders"("coupon_id");

-- AddForeignKey: coupon_usages → coupons
ALTER TABLE "coupon_usages"
    ADD CONSTRAINT "coupon_usages_coupon_id_fkey"
    FOREIGN KEY ("coupon_id") REFERENCES "coupons"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: coupon_usages → users
ALTER TABLE "coupon_usages"
    ADD CONSTRAINT "coupon_usages_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: coupon_usages → orders
ALTER TABLE "coupon_usages"
    ADD CONSTRAINT "coupon_usages_order_id_fkey"
    FOREIGN KEY ("order_id") REFERENCES "orders"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: orders → coupons
ALTER TABLE "orders"
    ADD CONSTRAINT "orders_coupon_id_fkey"
    FOREIGN KEY ("coupon_id") REFERENCES "coupons"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
