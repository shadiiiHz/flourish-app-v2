-- CreateEnum
CREATE TYPE "CustomerSource" AS ENUM ('website', 'admin');

-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "source" "CustomerSource" NOT NULL DEFAULT 'website';
