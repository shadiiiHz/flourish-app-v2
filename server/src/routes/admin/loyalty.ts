import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { asyncHandler } from "../../lib/asyncHandler.js";
import {
  buildLoyaltyStatus,
  countedOrders,
  getLoyaltyTiers,
  LOYALTY_MIN_POINTS,
  pointsFromAmount,
} from "../../lib/loyalty.js";

export const adminLoyaltyRouter = Router();

adminLoyaltyRouter.get(
  "/tiers",
  asyncHandler(async (_req, res) => {
    res.json(await getLoyaltyTiers());
  }),
);

/** The customers with the most points, highest first (default 3). Customers with no points yet are left out. */
adminLoyaltyRouter.get(
  "/top",
  asyncHandler(async (req, res) => {
    const limit = Math.min(20, Math.max(1, Math.floor(Number(req.query.limit)) || 3));
    const [groups, offsetRows] = await Promise.all([
      prisma.order.groupBy({
        by: ["customerId"],
        where: { customerId: { not: null }, ...countedOrders },
        _sum: { subtotal: true, discountAmount: true },
      }),
      prisma.customer.findMany({ where: { loyaltyPointsOffset: { not: 0 } }, select: { id: true, loyaltyPointsOffset: true } }),
    ]);
    const offsets = new Map(offsetRows.map((c) => [c.id, c.loyaltyPointsOffset]));
    // Points use subtotal − discount, which the DB can't order by, so rank in memory.
    const ranked = groups
      .map((g) => ({
        customerId: g.customerId as string,
        points: Math.max(
          0,
          pointsFromAmount((g._sum.subtotal ?? 0) - (g._sum.discountAmount ?? 0)) + (offsets.get(g.customerId as string) ?? 0),
        ),
      }))
      .filter((g) => g.points > 0)
      .sort((a, b) => b.points - a.points)
      .slice(0, limit);
    const [customers, tiers] = await Promise.all([
      prisma.customer.findMany({
        where: { id: { in: ranked.map((r) => r.customerId) } },
        select: { id: true, phone: true, firstName: true, lastName: true },
      }),
      getLoyaltyTiers(),
    ]);
    const byId = new Map(customers.map((c) => [c.id, c]));
    res.json(
      ranked.flatMap((r) => {
        const customer = byId.get(r.customerId);
        return customer ? [{ ...customer, loyalty: buildLoyaltyStatus(r.points, tiers) }] : [];
      }),
    );
  }),
);

const tiersSchema = z.object({
  tiers: z
    .array(
      z.object({
        level: z.number().int().min(1).max(LOYALTY_MIN_POINTS.length),
        name: z.string().trim().min(1, "نام هر سطح الزامی است").max(40),
        cashbackPercent: z.number().int().min(0).max(100),
      }),
    )
    .length(LOYALTY_MIN_POINTS.length)
    .refine((tiers) => new Set(tiers.map((t) => t.level)).size === tiers.length, {
      message: "سطح‌ها تکراری هستند",
    }),
});

adminLoyaltyRouter.put(
  "/tiers",
  asyncHandler(async (req, res) => {
    const parsed = tiersSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? "اطلاعات سطح‌ها نامعتبر است" });
      return;
    }
    await getLoyaltyTiers(); // make sure all four rows exist
    await prisma.$transaction(
      parsed.data.tiers.map((t) =>
        prisma.loyaltyTier.update({
          where: { level: t.level },
          data: { name: t.name, cashbackPercent: t.cashbackPercent },
        }),
      ),
    );
    res.json(await getLoyaltyTiers());
  }),
);
