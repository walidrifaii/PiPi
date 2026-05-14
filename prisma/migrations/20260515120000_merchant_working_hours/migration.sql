-- Merchant working hours (IANA timezone + weekly intervals in local time).
ALTER TABLE "merchants" ADD COLUMN "timezone" VARCHAR(64);
ALTER TABLE "merchants" ADD COLUMN "use_working_hours" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "merchants" ADD COLUMN "working_hours_json" JSONB;
