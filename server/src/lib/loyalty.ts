import { prisma } from "./prisma.js";

/** Every 5,000 Toman of an order's final total earns one loyalty point. */
export const TOMAN_PER_POINT = 5000;

/** Minimum points for each level (1..4). Fixed — the admin only edits each level's name and cashback percent. */
export const LOYALTY_MIN_POINTS = [0, 5000, 15000, 30000] as const;

const DEFAULT_TIER_NAMES = ["Seed", "Bloom", "Prestige", "Flourish"] as const;
const DEFAULT_TIER_PERCENTS = [5, 9, 12, 20] as const;

export interface LoyaltyTierInfo {
  level: number;
  name: string;
  cashbackPercent: number;
  minPoints: number;
}

export interface LoyaltyStatus {
  points: number;
  tier: LoyaltyTierInfo;
  /** Null once the customer is already on the top level. */
  nextTier: LoyaltyTierInfo | null;
  pointsToNextTier: number;
}

/**
 * Orders that count towards a customer's points: paid and not cancelled. The
 * amount is the order's final total (items − discount + tax + shipping), including
 * any part settled from the wallet. Points are always derived from the orders
 * themselves, so cancelling/editing/deleting an order and back-filling existing
 * customers all need no extra bookkeeping.
 */
export const countedOrders = { paymentStatus: "paid", status: { not: "cancelled" } } as const;

export function pointsFromTotal(totalToman: number): number {
  return Math.floor(Math.max(0, totalToman) / TOMAN_PER_POINT);
}

/** The four levels with their admin-configured names/percents, creating any missing rows with defaults. */
export async function getLoyaltyTiers(): Promise<LoyaltyTierInfo[]> {
  let rows = await prisma.loyaltyTier.findMany({ orderBy: { level: "asc" } });
  if (rows.length < LOYALTY_MIN_POINTS.length) {
    await prisma.loyaltyTier.createMany({
      data: LOYALTY_MIN_POINTS.map((_, i) => ({
        level: i + 1,
        name: DEFAULT_TIER_NAMES[i],
        cashbackPercent: DEFAULT_TIER_PERCENTS[i],
      })),
      skipDuplicates: true,
    });
    rows = await prisma.loyaltyTier.findMany({ orderBy: { level: "asc" } });
  }
  return rows.map((row) => ({
    level: row.level,
    name: row.name,
    cashbackPercent: row.cashbackPercent,
    minPoints: LOYALTY_MIN_POINTS[row.level - 1] ?? 0,
  }));
}

export function tierForPoints(points: number, tiers: LoyaltyTierInfo[]): LoyaltyTierInfo {
  let current = tiers[0];
  for (const tier of tiers) {
    if (points >= tier.minPoints) current = tier;
  }
  return current;
}

/** A customer's points. `excludeOrderId` leaves one order out (the tier they held *before* that purchase). */
export async function getCustomerPoints(customerId: string, excludeOrderId?: string): Promise<number> {
  const agg = await prisma.order.aggregate({
    where: { customerId, ...countedOrders, ...(excludeOrderId ? { id: { not: excludeOrderId } } : {}) },
    _sum: { total: true },
  });
  return pointsFromTotal(agg._sum.total ?? 0);
}

/** Points for many customers at once (admin lists). Customers with no counted orders map to 0. */
export async function getPointsByCustomer(customerIds: string[]): Promise<Map<string, number>> {
  const result = new Map<string, number>(customerIds.map((id) => [id, 0]));
  if (customerIds.length === 0) return result;
  const groups = await prisma.order.groupBy({
    by: ["customerId"],
    where: { customerId: { in: customerIds }, ...countedOrders },
    _sum: { total: true },
  });
  for (const group of groups) {
    if (group.customerId) result.set(group.customerId, pointsFromTotal(group._sum.total ?? 0));
  }
  return result;
}

export function buildLoyaltyStatus(points: number, tiers: LoyaltyTierInfo[]): LoyaltyStatus {
  const tier = tierForPoints(points, tiers);
  const nextTier = tiers.find((t) => t.level === tier.level + 1) ?? null;
  return {
    points,
    tier,
    nextTier,
    pointsToNextTier: nextTier ? Math.max(0, nextTier.minPoints - points) : 0,
  };
}

export async function getLoyaltyStatus(customerId: string): Promise<LoyaltyStatus> {
  const [points, tiers] = await Promise.all([getCustomerPoints(customerId), getLoyaltyTiers()]);
  return buildLoyaltyStatus(points, tiers);
}
