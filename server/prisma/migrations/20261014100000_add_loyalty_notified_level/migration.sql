-- The loyalty level a customer was last texted about, so a "level up" SMS goes out once per step up.
ALTER TABLE "Customer" ADD COLUMN "loyaltyNotifiedLevel" INTEGER NOT NULL DEFAULT 1;

-- Backfill with each customer's current level so existing customers aren't texted for levels they already hold.
UPDATE "Customer" c
SET "loyaltyNotifiedLevel" = COALESCE((
  SELECT MAX(t."level")
  FROM "LoyaltyTier" t
  WHERE t."minPoints" <= GREATEST(0,
    COALESCE((
      SELECT FLOOR(GREATEST(0, SUM(o."subtotal" - o."discountAmount" - o."walletAmountUsed")) / 5000.0)
      FROM "Order" o
      WHERE o."customerId" = c."id" AND o."paymentStatus" = 'paid' AND o."status" <> 'cancelled'
    ), 0) + c."loyaltyPointsOffset")
), 1);
