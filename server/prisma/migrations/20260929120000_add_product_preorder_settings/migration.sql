-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "preorderDiscountPercent" INTEGER,
ADD COLUMN     "preorderWeekdays" INTEGER[] DEFAULT ARRAY[]::INTEGER[];
