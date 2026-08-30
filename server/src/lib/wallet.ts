import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "./prisma.js";
import { getSettings } from "./shipping.js";

/** How long a cashback grant stays spendable before it's clawed back — see expireStaleWalletCashback. */
const CASHBACK_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000;

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

/** Reverses a wallet redemption for an order whose payment ultimately failed. Safe to call once. */
export async function refundWalletHold(orderId: string) {
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
        note: "بازگشت وجه به دلیل ناموفق بودن پرداخت",
      },
    });
    await tx.order.update({ where: { id: order.id }, data: { walletAmountUsed: 0 } });
  });
}

/**
 * Credits cashback for an order once it's marked as delivered, based on the
 * admin-configured percent of the item subtotal actually paid out of pocket
 * — any part of the subtotal covered by wallet balance (which can only have
 * come from previously-earned cashback) is excluded, so cashback can't be
 * recycled into more cashback on money that was itself a reward. Safe to
 * call more than once — only the first call (per delivery) actually credits.
 */
export async function creditWalletCashback(orderId: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order || !order.customerId) return;
  if (order.paymentStatus !== "paid") return;
  const settings = await getSettings();
  const percent = settings.walletCashbackPercent;
  if (percent <= 0) return;
  const netSubtotal = Math.max(0, order.subtotal - order.walletAmountUsed);
  const cashback = Math.floor((netSubtotal * percent) / 100);
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

/** Reverses previously-credited cashback for a cancelled order. No-op if no cashback was credited. */
export async function reverseWalletCashback(orderId: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order || !order.customerId || order.walletCashbackAmount <= 0) return;
  await prisma.$transaction(async (tx) => {
    const claimed = await tx.order.updateMany({
      where: { id: order.id, walletCashbackAmount: { gt: 0 } },
      data: { walletCashbackAmount: 0 },
    });
    if (claimed.count === 0) return;
    const reversedAmount = order.walletCashbackAmount;
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
        note: "لغو پاداش خرید به دلیل لغو سفارش",
      },
    });
    // The original grant is fully undone here, not merely spent — clear its
    // remaining balance so expireStaleWalletCashback never claws it back too.
    await tx.walletTransaction.updateMany({
      where: { orderId: order.id, type: "cashback", remainingAmount: { gt: 0 } },
      data: { remainingAmount: 0 },
    });
  });
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
      const claimed = await tx.walletTransaction.updateMany({
        where: { id: lot.id, remainingAmount: { gt: 0 } },
        data: { remainingAmount: 0 },
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
