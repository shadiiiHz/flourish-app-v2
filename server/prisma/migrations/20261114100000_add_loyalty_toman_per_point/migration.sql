-- AlterTable
ALTER TABLE "Settings" ADD COLUMN "loyaltyTomanPerPoint" INTEGER NOT NULL DEFAULT 5000;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN "loyaltyTomanPerPoint" INTEGER NOT NULL DEFAULT 5000;
