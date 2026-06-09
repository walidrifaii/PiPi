-- Per-merchant food earnings share override (null = global default).
ALTER TABLE "merchants" ADD COLUMN "food_share_percent" DECIMAL(5, 2);
