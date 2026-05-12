/*
  Warnings:

  - You are about to drop the column `status` on the `merchants` table. All the data in the column will be lost.
  - You are about to drop the `merchant_admins` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `merchant_servers` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "merchant_admins" DROP CONSTRAINT "merchant_admins_merchant_id_fkey";

-- DropForeignKey
ALTER TABLE "merchant_servers" DROP CONSTRAINT "merchant_servers_merchant_id_fkey";

-- AlterTable
ALTER TABLE "merchants" DROP COLUMN "status";

-- DropTable
DROP TABLE "merchant_admins";

-- DropTable
DROP TABLE "merchant_servers";
