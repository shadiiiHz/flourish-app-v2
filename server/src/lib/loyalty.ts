import { prisma } from "./prisma.js";

/** Every 5,000 Toman of an order's items subtotal (after the discount code, excluding the part paid from the wallet) earns one loyalty point. */
export const TOMAN_PER_POINT = 5000;

/** Levels created when none exist yet. The admin can change the number of levels, each one's point range, name and cashback percent. */
const DEFAULT_TIERS = [
  { name: "Seed", cashbackPercent: 5, minPoints: 0 },
  { name: "Bloom", cashbackPercent: 9, minPoints: 5000 },
  { name: "Prestige", cashbackPercent: 12, minPoints: 15000 },
  { name: "Flourish", cashbackPercent: 20, minPoints: 30000 },
] as const;

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
 * amount is the order's items subtotal minus its discount code (tax and shipping are not
 * counted), including any part settled from the wallet. Points are always derived from the orders
 * themselves, so cancelling/editing/deleting an order and back-filling existing
 * customers all need no extra bookkeeping.
 */
export const countedOrders = { paymentStatus: "paid", status: { not: "cancelled" } } as const;

/** Sum of (subtotal − discountAmount − walletAmountUsed) over the counted orders: money paid from the wallet (cashback) earns no points. */
export function netPointsAmount(sum: { subtotal: number | null; discountAmount: number | null; walletAmountUsed: number | null }): number {
  return (sum.subtotal ?? 0) - (sum.discountAmount ?? 0) - (sum.walletAmountUsed ?? 0);
}

/** `amountToman` is the result of netPointsAmount over the counted orders. */
export function pointsFromAmount(amountToman: number): number {
  return Math.floor(Math.max(0, amountToman) / TOMAN_PER_POINT);
}

/** The levels (1..N) with their admin-configured ranges/names/percents, creating the defaults if none exist. */
export async function getLoyaltyTiers(): Promise<LoyaltyTierInfo[]> {
  let rows = await prisma.loyaltyTier.findMany({ orderBy: { level: "asc" } });
  if (rows.length === 0) {
    await prisma.loyaltyTier.createMany({
      data: DEFAULT_TIERS.map((t, i) => ({ level: i + 1, ...t })),
      skipDuplicates: true,
    });
    rows = await prisma.loyaltyTier.findMany({ orderBy: { level: "asc" } });
  }
  return rows.map((row) => ({
    level: row.level,
    name: row.name,
    cashbackPercent: row.cashbackPercent,
    minPoints: row.minPoints,
  }));
}

export function tierForPoints(points: number, tiers: LoyaltyTierInfo[]): LoyaltyTierInfo {
  let current = tiers[0];
  for (const tier of tiers) {
    if (points >= tier.minPoints) current = tier;
  }
  return current;
}

/** Months without a counted order before a customer drops one level (and again for every further period). */
export const DECAY_PERIOD_MONTHS = 3;

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

/**
 * Pure demotion rule. The idle clock starts at the later of the last counted order and the last
 * demotion; every full 3 months since then costs one level (never below level 1). A demoted customer's
 * points are cut to the minimum of the level they land on, so they have to earn that level's range again.
 * Returns the new offset/anchor, or null when nothing changes.
 */
export function computeDecay(input: {
  /** Minimum points of each level, ascending (index 0 is level 1). */
  minPoints: readonly number[];
  derivedPoints: number;
  offset: number;
  anchor: Date | null;
  lastOrderAt: Date | null;
  now: Date;
}): { offset: number; anchor: Date; level: number } | null {
  const { minPoints, derivedPoints, offset, anchor, lastOrderAt, now } = input;
  const reference = [lastOrderAt, anchor].filter((d): d is Date => !!d).sort((a, b) => b.getTime() - a.getTime())[0];
  if (!reference) return null;
  let periods = 0;
  while (addMonths(reference, DECAY_PERIOD_MONTHS * (periods + 1)) <= now) periods++;
  if (periods === 0) return null;

  const points = Math.max(0, derivedPoints + offset);
  let level = 1;
  minPoints.forEach((min, i) => {
    if (points >= min) level = i + 1;
  });
  if (level === 1) return null;
  const newLevel = Math.max(1, level - periods);
  return {
    offset: (minPoints[newLevel - 1] ?? 0) - derivedPoints,
    anchor: addMonths(reference, DECAY_PERIOD_MONTHS * periods),
    level: newLevel,
  };
}

/**
 * Applies any due inactivity demotion to one customer and saves it. `now` / `excludeOrderId` let the
 * cashback code ask "what level did they hold just before this purchase" — decay as of that order's date,
 * ignoring that order. Safe to call repeatedly; concurrent callers can't demote twice.
 */
export async function applyLoyaltyDecay(
  customerId: string,
  opts: { now?: Date; excludeOrderId?: string } = {},
): Promise<void> {
  const where = { customerId, ...countedOrders, ...(opts.excludeOrderId ? { id: { not: opts.excludeOrderId } } : {}) };
  const [customer, agg, tiers] = await Promise.all([
    prisma.customer.findUnique({
      where: { id: customerId },
      select: { loyaltyPointsOffset: true, loyaltyDecayAnchor: true },
    }),
    prisma.order.aggregate({ where, _sum: { subtotal: true, discountAmount: true, walletAmountUsed: true }, _max: { createdAt: true } }),
    getLoyaltyTiers(),
  ]);
  if (!customer) return;
  const result = computeDecay({
    minPoints: tiers.map((t) => t.minPoints),
    derivedPoints: pointsFromAmount(netPointsAmount(agg._sum)),
    offset: customer.loyaltyPointsOffset,
    anchor: customer.loyaltyDecayAnchor,
    lastOrderAt: agg._max.createdAt,
    now: opts.now ?? new Date(),
  });
  if (!result) return;
  await prisma.customer.updateMany({
    where: {
      id: customerId,
      loyaltyPointsOffset: customer.loyaltyPointsOffset,
      loyaltyDecayAnchor: customer.loyaltyDecayAnchor,
    },
    data: { loyaltyPointsOffset: result.offset, loyaltyDecayAnchor: result.anchor, loyaltyNotifiedLevel: result.level },
  });
}

/** Demotes every customer whose idle period has run out. Run daily. */
export async function sweepLoyaltyDecay(): Promise<void> {
  const [groups, customers, tiers] = await Promise.all([
    prisma.order.groupBy({
      by: ["customerId"],
      where: { customerId: { not: null }, ...countedOrders },
      _sum: { subtotal: true, discountAmount: true, walletAmountUsed: true },
      _max: { createdAt: true },
    }),
    prisma.customer.findMany({ select: { id: true, loyaltyPointsOffset: true, loyaltyDecayAnchor: true } }),
    getLoyaltyTiers(),
  ]);
  const minPoints = tiers.map((t) => t.minPoints);
  const byId = new Map(customers.map((c) => [c.id, c]));
  const now = new Date();
  for (const g of groups) {
    const customer = g.customerId ? byId.get(g.customerId) : undefined;
    if (!customer) continue;
    const result = computeDecay({
      minPoints,
      derivedPoints: pointsFromAmount(netPointsAmount(g._sum)),
      offset: customer.loyaltyPointsOffset,
      anchor: customer.loyaltyDecayAnchor,
      lastOrderAt: g._max.createdAt,
      now,
    });
    if (!result) continue;
    await prisma.customer.updateMany({
      where: {
        id: customer.id,
        loyaltyPointsOffset: customer.loyaltyPointsOffset,
        loyaltyDecayAnchor: customer.loyaltyDecayAnchor,
      },
      data: { loyaltyPointsOffset: result.offset, loyaltyDecayAnchor: result.anchor, loyaltyNotifiedLevel: result.level },
    });
  }
}

const DECAY_SWEEP_INTERVAL_MS = 24 * 60 * 60 * 1000;

/** Starts the daily demotion sweep (plain interval, like the other crons). Call once from the server entrypoint. */
export function startLoyaltyDecayCron(): void {
  const sweep = () => {
    sweepLoyaltyDecay().catch((err) => {
      console.error("Failed to sweep loyalty decay:", err);
    });
  };
  sweep();
  setInterval(sweep, DECAY_SWEEP_INTERVAL_MS);
}

/** A customer's points (order-derived + demotion offset). `excludeOrderId` leaves one order out (the tier they held *before* that purchase). */
export async function getCustomerPoints(customerId: string, excludeOrderId?: string): Promise<number> {
  const [agg, customer] = await Promise.all([
    prisma.order.aggregate({
      where: { customerId, ...countedOrders, ...(excludeOrderId ? { id: { not: excludeOrderId } } : {}) },
      _sum: { subtotal: true, discountAmount: true, walletAmountUsed: true },
    }),
    prisma.customer.findUnique({ where: { id: customerId }, select: { loyaltyPointsOffset: true } }),
  ]);
  const derived = pointsFromAmount(netPointsAmount(agg._sum));
  return Math.max(0, derived + (customer?.loyaltyPointsOffset ?? 0));
}

/** Points for many customers at once (admin lists). Customers with no counted orders map to 0. */
export async function getPointsByCustomer(customerIds: string[]): Promise<Map<string, number>> {
  const result = new Map<string, number>(customerIds.map((id) => [id, 0]));
  if (customerIds.length === 0) return result;
  const [groups, customers] = await Promise.all([
    prisma.order.groupBy({
      by: ["customerId"],
      where: { customerId: { in: customerIds }, ...countedOrders },
      _sum: { subtotal: true, discountAmount: true, walletAmountUsed: true },
    }),
    prisma.customer.findMany({ where: { id: { in: customerIds } }, select: { id: true, loyaltyPointsOffset: true } }),
  ]);
  const offsets = new Map(customers.map((c) => [c.id, c.loyaltyPointsOffset]));
  for (const group of groups) {
    if (group.customerId) {
      const derived = pointsFromAmount(netPointsAmount(group._sum));
      result.set(group.customerId, Math.max(0, derived + (offsets.get(group.customerId) ?? 0)));
    }
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
  await applyLoyaltyDecay(customerId);
  const [points, tiers] = await Promise.all([getCustomerPoints(customerId), getLoyaltyTiers()]);
  return buildLoyaltyStatus(points, tiers);
}
