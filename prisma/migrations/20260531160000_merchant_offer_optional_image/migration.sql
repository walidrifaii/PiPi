-- Offer cards use the merchant cover/logo; per-offer upload is no longer required.
ALTER TABLE "merchant_offers" ALTER COLUMN "image_url" DROP NOT NULL;
