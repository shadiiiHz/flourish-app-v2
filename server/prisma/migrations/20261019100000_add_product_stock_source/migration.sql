-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "stockSourceId" TEXT;

-- CreateIndex
CREATE INDEX "Product_stockSourceId_idx" ON "Product"("stockSourceId");

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_stockSourceId_fkey" FOREIGN KEY ("stockSourceId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
