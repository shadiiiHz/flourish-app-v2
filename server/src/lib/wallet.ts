import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "./prisma.js";
import { applyLoyaltyDecay, getCustomerPoints, getLoyaltyTiers, tierForPoints } from "./loyalty.js";

/** How long a cashback grant stays spendable before it's clawed back — see expireStaleWalletCashback. */
export const CASHBACK_EXPIRY_DAYS = 30;
const CASHBACK_EXPIRY_MS = CASHBACK_EXPIRY_DAYS * 24 * 60 * 60 * 1000;

/**
 * Marks `amount` of the customer's oldest still-active cashback grants as
 * used, oldest (soonest to expire) first, so spent cashback isn't later
 * clawed back by expireStaleWalletCashback. A debit can also draw on
 * non-cashback wallet money (e.g. a refund), in which case it simply runs
 * out of grants to consume partway through — that's fine.
 */
async function consumeCashbackLots(
  tx: Prisma.TransactionClient | PrismaClient,
  customerId: string,
  amount: number,
): Promise<void> {
  let remaining = amount;
  if (remaining <= 0) return;
  const lots = await tx.walletTransaction.findMany({
    where: { customerId, type: "cashback", remainingAmount: { gt: 0 } },
    orderBy: { createdAt: "asc" },
  });
  for (const lot of lots) {
    if (remaining <= 0) break;
    const used = Math.min(lot.remainingAmount ?? 0, remaining);
    if (used <= 0) continue;
    await tx.walletTransaction.update({
      where: { id: lot.id },
      data: { remainingAmount: { decrement: used } },
    });
    remaining -= used;
  }
}

/** Cashback from this order's open grants that is still sitting unspent in the customer's wallet. */
export async function getOutstandingOrderCashback(orderId: string): Promise<number> {
  const lots = await prisma.walletTransaction.findMany({
    where: { orderId, type: "cashback", reversedAt: null },
  });
  return lots.reduce((sum, l) => sum + Math.max(0, l.remainingAmount ?? 0), 0);
}

/**
 * Manual admin debit of a customer's wallet. Returns the new balance, or null when `amount`
 * exceeds the balance (checked atomically with the debit, so concurrent spends can't overdraw).
 */
export async function adminDeductWallet(
  customerId: string,
  amount: number,
  note: string,
): Promise<number | null> {
  return prisma.$transaction(async (tx) => {
    const debited = await tx.customer.updateMany({
      where: { id: customerId, walletBalance: { gte: amount } },
      data: { walletBalance: { decrement: amount } },
    });
    if (debited.count === 0) return null;
    const customer = await tx.customer.findUniqueOrThrow({ where: { id: customerId } });
    await tx.walletTransaction.create({
      data: {
        customerId,
        type: "admin_deduction",
        amount: -amount,
        balanceAfter: customer.walletBalance,
        note,
      },
    });
    await consumeCashbackLots(tx, customerId, amount);
    return customer.walletBalance;
  });
}

/** Debits the customer's wallet by `amount` and records the redemption, right when an order is created. */
export async function redeemWallet(customerId: string, amount: number, orderId: string) {
  await prisma.$transaction(async (tx) => {
    const customer = await tx.customer.update({
      where: { id: customerId },
      data: { walletBalance: { decrement: amount } },
    });
    await tx.walletTransaction.create({
      data: {
        customerId,
        orderId,
        type: "redeem",
        amount: -amount,
        balanceAfter: customer.walletBalance,
        note: "استفاده در سفارش",
      },
    });
    await consumeCashbackLots(tx, customerId, amount);
  });
}

/**
 * Reverses a wallet redemption held against an order — e.g. a payment that
 * ultimately failed, or an order that got cancelled/deleted after the
 * customer's wallet was already debited for it. Safe to call once; a second
 * call is a no-op since walletAmountUsed is zeroed after the first refund.
 */
export async function refundWalletHold(
  orderId: string,
  note = "بازگشت وجه به دلیل ناموفق بودن پرداخت",
) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order || !order.customerId || order.walletAmountUsed <= 0) return;
  await prisma.$transaction(async (tx) => {
    const customer = await tx.customer.update({
      where: { id: order.customerId! },
      data: { walletBalance: { increment: order.walletAmountUsed } },
    });
    await tx.walletTransaction.create({
      data: {
        customerId: order.customerId!,
        orderId: order.id,
        type: "refund",
        amount: order.walletAmountUsed,
        balanceAfter: customer.walletBalance,
        note,
      },
    });
    await tx.order.update({ where: { id: order.id }, data: { walletAmountUsed: 0 } });
  });
}

/**
 * Credits cashback for an order once it's marked as delivered, based on the
 * cashback percent of the customer's loyalty tier (admin-configured per tier,
 * using the tier they held before this purchase) applied to the item subtotal actually paid out of pocket
 * — any part of the subtotal covered by wallet balance (which can only have
 * come from previously-earned cashback) is excluded, so cashback can't be
 * recycled into more cashback on money that was itself a reward. Safe to
 * call more than once — only the first call (per delivery) actually credits.
 */
export async function creditWalletCashback(orderId: string, alreadyPaid = 0) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order || !order.customerId) return;
  if (order.paymentStatus !== "paid") return;
  // The tier held just before this purchase includes any inactivity demotion due by the order date.
  await applyLoyaltyDecay(order.customerId, { now: order.createdAt, excludeOrderId: order.id });
  const [points, tiers] = await Promise.all([
    getCustomerPoints(order.customerId, order.id),
    getLoyaltyTiers(),
  ]);
  const percent = tierForPoints(points, tiers).cashbackPercent;
  if (percent <= 0) return;
  const netSubtotal = Math.max(0, order.subtotal - order.walletAmountUsed);
  // alreadyPaid: cashback from a previous version of this order that the customer already spent.
  const cashback = Math.floor((netSubtotal * percent) / 100) - alreadyPaid;
  if (cashback <= 0) return;
  await prisma.$transaction(async (tx) => {
    // Claim the credit atomically: only proceeds if no cashback is outstanding yet, so
    // concurrent/duplicate calls (or a re-delivery after a cancellation reversal) can't double-credit.
    const claimed = await tx.order.updateMany({
      where: { id: order.id, walletCashbackAmount: 0 },
      data: { walletCashbackAmount: cashback },
    });
    if (claimed.count === 0) return;
    const customer = await tx.customer.update({
      where: { id: order.customerId! },
      data: { walletBalance: { increment: cashback } },
    });
    await tx.walletTransaction.create({
      data: {
        customerId: order.customerId!,
        orderId: order.id,
        type: "cashback",
        amount: cashback,
        balanceAfter: customer.walletBalance,
        note: "پاداش خرید",
        remainingAmount: cashback,
        expiresAt: new Date(Date.now() + CASHBACK_EXPIRY_MS),
      },
    });
  });
}

/**
 * Reverses previously-credited cashback for a cancelled order. Only claws
 * back what the customer hasn't already spent elsewhere (the grant's
 * remainingAmount) — money genuinely spent from a since-cancelled grant is
 * gone, not still sitting in the wallet, so clawing back the full original
 * amount would over-deduct. No-op if no cashback was credited.
 */
export async function reverseWalletCashback(
  orderId: string,
  note = "لغو پاداش خرید به دلیل لغو سفارش",
): Promise<void> {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order || !order.customerId || order.walletCashbackAmount <= 0) return;
  await prisma.$transaction(async (tx) => {
    const claimedOrder = await tx.order.updateMany({
      where: { id: order.id, walletCashbackAmount: { gt: 0 } },
      data: { walletCashbackAmount: 0 },
    });
    if (claimedOrder.count === 0) return;

    // An edited order accumulates several grants over time (earlier ones already
    // settled), so close out every still-open one, not just the first row found.
    const lots = await tx.walletTransaction.findMany({
      where: { orderId: order.id, type: "cashback", reversedAt: null },
    });
    // Settle them now either way, so expireStaleWalletCashback and the admin UI
    // leave them alone from here on, regardless of how much is actually clawed back.
    if (lots.length > 0) {
      await tx.walletTransaction.updateMany({
        where: { id: { in: lots.map((l) => l.id) } },
        data: { remainingAmount: 0, reversedAt: new Date() },
      });
    }

    const reversedAmount = lots.reduce((sum, l) => sum + (l.remainingAmount ?? 0), 0);
    if (reversedAmount <= 0) return;

    const customer = await tx.customer.update({
      where: { id: order.customerId! },
      data: { walletBalance: { decrement: reversedAmount } },
    });
    await tx.walletTransaction.create({
      data: {
        customerId: order.customerId!,
        orderId: order.id,
        type: "cashback_reversal",
        amount: -reversedAmount,
        balanceAfter: customer.walletBalance,
        note,
      },
    });
  });
}

/**
 * Net cashback this order has put into the customer's wallet over its whole
 * history (grants minus reversals/expiries). After reverseWalletCashback this
 * is the part the customer already spent, which stays with them; an order edit
 * must net it off the re-credit so that part isn't granted twice — even across
 * several edits, when no open grant remains to remember it.
 */
export async function getRetainedOrderCashback(orderId: string): Promise<number> {
  const txs = await prisma.walletTransaction.findMany({
    where: { orderId, type: { in: ["cashback", "cashback_reversal", "cashback_expired"] } },
  });
  return Math.max(0, txs.reduce((sum, t) => sum + t.amount, 0));
}

/**
 * Claws back whatever part of a customer's cashback grants is still unspent
 * once their one-month usage window has passed. Pass a customerId to scope
 * the sweep to one customer; omit it to sweep every customer, which is what
 * the daily background job (below) does.
 */
export async function expireStaleWalletCashback(customerId?: string): Promise<void> {
  const staleLots = await prisma.walletTransaction.findMany({
    where: {
      type: "cashback",
      remainingAmount: { gt: 0 },
      expiresAt: { lte: new Date() },
      ...(customerId ? { customerId } : {}),
    },
    select: { id: true, customerId: true, orderId: true },
  });
  for (const lot of staleLots) {
    await prisma.$transaction(async (tx) => {
      // Atomically claim this lot so a concurrent sweep can't double-expire it.
      const current = await tx.walletTransaction.findUnique({ where: { id: lot.id } });
      if (!current || (current.remainingAmount ?? 0) <= 0) return;
      // Marks the lot settled (reversedAt) as well as spent, so the admin
      // "reverse this grant" button can't later double-deduct a grant the
      // expiry sweep already clawed back.
      const claimed = await tx.walletTransaction.updateMany({
        where: { id: lot.id, remainingAmount: { gt: 0 } },
        data: { remainingAmount: 0, reversedAt: new Date() },
      });
      if (claimed.count === 0) return;
      const customer = await tx.customer.findUnique({ where: { id: lot.customerId } });
      if (!customer) return;
      const amountToDeduct = Math.min(current.remainingAmount ?? 0, customer.walletBalance);
      if (amountToDeduct <= 0) return;
      const updated = await tx.customer.update({
        where: { id: lot.customerId },
        data: { walletBalance: { decrement: amountToDeduct } },
      });
      await tx.walletTransaction.create({
        data: {
          customerId: lot.customerId,
          orderId: lot.orderId,
          type: "cashback_expired",
          amount: -amountToDeduct,
          balanceAfter: updated.walletBalance,
          note: "کسر پاداش خرید به دلیل استفاده نشدن در مهلت یک‌ماهه",
        },
      });
    });
  }
}

const CASHBACK_SWEEP_INTERVAL_MS = 24 * 60 * 60 * 1000;

/**
 * Starts the daily background sweep that expires unused cashback across all
 * customers. This app has no external task scheduler, so a plain interval on
 * the running Node process stands in for a cron job — call this once, from
 * the server entrypoint, after it starts listening.
 */
export function startWalletCashbackExpiryCron(): void {
  const sweep = () => {
    expireStaleWalletCashback().catch((err) => {
      console.error("Failed to sweep expired wallet cashback:", err);
    });
  };
  sweep();
  setInterval(sweep, CASHBACK_SWEEP_INTERVAL_MS);
}
