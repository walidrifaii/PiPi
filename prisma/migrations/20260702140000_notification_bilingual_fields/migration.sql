-- Bilingual notification copy (en + ar) for inbox and admin broadcasts.

ALTER TABLE "user_notifications" ADD COLUMN "title_ar" VARCHAR(255);
ALTER TABLE "user_notifications" ADD COLUMN "message_ar" TEXT;

ALTER TABLE "notification_broadcasts" ADD COLUMN "title_ar" VARCHAR(255);
ALTER TABLE "notification_broadcasts" ADD COLUMN "message_ar" TEXT;
