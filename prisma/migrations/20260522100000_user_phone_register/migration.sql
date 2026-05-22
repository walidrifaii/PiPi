-- DropNotNull
ALTER TABLE "users" ALTER COLUMN "password_hash" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");
