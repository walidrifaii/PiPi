-- CreateTable
CREATE TABLE "notification_broadcasts" (
    "id" UUID NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "message" TEXT NOT NULL,
    "category" VARCHAR(32) NOT NULL DEFAULT 'SPECIAL_OFFER',
    "status" VARCHAR(20) NOT NULL DEFAULT 'IN_PROGRESS',
    "last_user_id" UUID,
    "total_users" INTEGER NOT NULL DEFAULT 0,
    "users_processed" INTEGER NOT NULL DEFAULT 0,
    "inbox_created" INTEGER NOT NULL DEFAULT 0,
    "push_success_count" INTEGER NOT NULL DEFAULT 0,
    "push_failure_count" INTEGER NOT NULL DEFAULT 0,
    "send_push" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_broadcasts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notification_broadcasts_status_created_at_idx" ON "notification_broadcasts"("status", "created_at" DESC);
