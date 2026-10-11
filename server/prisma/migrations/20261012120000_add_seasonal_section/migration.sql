-- Homepage seasonal section: per-product flag and the admin-chosen theme.
ALTER TABLE "Product" ADD COLUMN "isSeasonal" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Settings" ADD COLUMN "seasonalTheme" TEXT NOT NULL DEFAULT 'spring';
