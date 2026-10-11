-- Rename the original placeholder tier names to the final defaults. Only rows still
-- carrying the old default name are touched, so names an admin already customised stay.
UPDATE "LoyaltyTier" SET "name" = 'Seed' WHERE "level" = 1 AND "name" = 'برنزی';
UPDATE "LoyaltyTier" SET "name" = 'Bloom' WHERE "level" = 2 AND "name" = 'نقره‌ای';
UPDATE "LoyaltyTier" SET "name" = 'Prestige' WHERE "level" = 3 AND "name" = 'طلایی';
UPDATE "LoyaltyTier" SET "name" = 'Flourish' WHERE "level" = 4 AND "name" = 'الماسی';
