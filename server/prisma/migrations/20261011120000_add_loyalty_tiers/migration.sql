-- CreateTable
CREATE TABLE "LoyaltyTier" (
    "level" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "cashbackPercent" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoyaltyTier_pkey" PRIMARY KEY ("level")
);

-- Seed the four fixed levels. Every level starts at the cashback percent the admin
-- had configured before tiers existed, so nothing changes until they edit them.
INSERT INTO "LoyaltyTier" ("level", "name", "cashbackPercent", "updatedAt")
SELECT t."level", t."name", COALESCE((SELECT "walletCashbackPercent" FROM "Settings" WHERE "id" = 1), 0), CURRENT_TIMESTAMP
FROM (VALUES (1, 'برنزی'), (2, 'نقره‌ای'), (3, 'طلایی'), (4, 'الماسی')) AS t("level", "name");
