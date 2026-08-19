import { prisma } from "./prisma.js";
import { getSettings } from "./shipping.js";

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

/** Credits cashback for an order once it's marked as delivered, based on the admin-configured percent of the item subtotal. Safe to call more than once — only the first call (per delivery) actually credits. */
export async function creditWalletCashback(orderId: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order || !order.customerId) return;
  if (order.paymentStatus !== "paid") return;
  const settings = await getSettings();
  const percent = settings.walletCashbackPercent;
  if (percent <= 0) return;
  const cashback = Math.floor((order.subtotal * percent) / 100);
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
  });
}
