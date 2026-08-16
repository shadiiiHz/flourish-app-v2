-- CreateEnum
CREATE TYPE "OrderType" AS ENUM ('instant', 'preorder');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "orderType" "OrderType" NOT NULL DEFAULT 'instant',
ADD COLUMN     "scheduledDate" TIMESTAMP(3),
ADD COLUMN     "scheduledTimeSlot" TEXT;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "allowPreorder" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "isAvailable" BOOLEAN NOT NULL DEFAULT true;
