-- Inactivity demotion: a points adjustment on top of the order-derived points, and the time of the last demotion.
ALTER TABLE "Customer" ADD COLUMN "loyaltyPointsOffset" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Customer" ADD COLUMN "loyaltyDecayAnchor" TIMESTAMP(3);
