-- Point thresholds used to be fixed in code; they are now editable per level.
ALTER TABLE "LoyaltyTier" ADD COLUMN "minPoints" INTEGER NOT NULL DEFAULT 0;

-- Keep the previous fixed thresholds for the existing four levels.
UPDATE "LoyaltyTier" SET "minPoints" = 0 WHERE "level" = 1;
UPDATE "LoyaltyTier" SET "minPoints" = 5000 WHERE "level" = 2;
UPDATE "LoyaltyTier" SET "minPoints" = 15000 WHERE "level" = 3;
UPDATE "LoyaltyTier" SET "minPoints" = 30000 WHERE "level" = 4;
