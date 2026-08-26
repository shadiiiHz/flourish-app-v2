-- CreateEnum
CREATE TYPE "DiscountCodeSource" AS ENUM ('manual', 'birthday');

-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "birthDate" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "DiscountCode" ADD COLUMN     "source" "DiscountCodeSource" NOT NULL DEFAULT 'manual',
ADD COLUMN     "customerId" TEXT,
ADD COLUMN     "validOnDate" TIMESTAMP(3),
ADD COLUMN     "usedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "DiscountCode_customerId_idx" ON "DiscountCode"("customerId");

-- AddForeignKey
ALTER TABLE "DiscountCode" ADD CONSTRAINT "DiscountCode_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
