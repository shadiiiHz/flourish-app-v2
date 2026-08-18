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

/** Credits cashback for a newly-paid order, based on the admin-configured percent of the item subtotal. */
export async function creditWalletCashback(orderId: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order || !order.customerId) return;
  const settings = await getSettings();
  const percent = settings.walletCashbackPercent;
  if (percent <= 0) return;
  const cashback = Math.floor((order.subtotal * percent) / 100);
  if (cashback <= 0) return;
  await prisma.$transaction(async (tx) => {
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
    await tx.order.update({ where: { id: order.id }, data: { walletCashbackAmount: cashback } });
  });
}
