-- CreateEnum
CREATE TYPE "OrderSource" AS ENUM ('website', 'admin');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "source" "OrderSource" NOT NULL DEFAULT 'website';
