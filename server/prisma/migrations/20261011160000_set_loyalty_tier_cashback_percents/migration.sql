-- Set the launch cashback percent for each loyalty level (admin can still change them afterwards).
UPDATE "LoyaltyTier" SET "cashbackPercent" = 5 WHERE "level" = 1;
UPDATE "LoyaltyTier" SET "cashbackPercent" = 9 WHERE "level" = 2;
UPDATE "LoyaltyTier" SET "cashbackPercent" = 12 WHERE "level" = 3;
UPDATE "LoyaltyTier" SET "cashbackPercent" = 20 WHERE "level" = 4;
