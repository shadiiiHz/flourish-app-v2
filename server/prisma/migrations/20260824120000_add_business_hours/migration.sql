-- AlterTable
ALTER TABLE "Settings" ADD COLUMN     "businessHoursEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Settings" ADD COLUMN     "businessHoursStart" TEXT NOT NULL DEFAULT '09:00';
ALTER TABLE "Settings" ADD COLUMN     "businessHoursEnd" TEXT NOT NULL DEFAULT '22:30';
