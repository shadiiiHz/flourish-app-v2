-- AlterTable
ALTER TABLE "WalletTransaction" ADD COLUMN     "remainingAmount" INTEGER,
ADD COLUMN     "expiresAt" TIMESTAMP(3);
