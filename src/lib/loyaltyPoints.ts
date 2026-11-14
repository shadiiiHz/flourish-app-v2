/** Mirrors server/src/lib/loyalty.ts — every N Toman of an order's items subtotal after the discount code and minus any part paid from the wallet (no tax or shipping) earns one point. N is admin-set and stored on each order. */
export const DEFAULT_TOMAN_PER_POINT = 5000;

/**
 * Whole points one order earns on its own (rounded down). Only paid, non-cancelled orders count.
 * Note the server floors the customer's *summed* subtotal per rate, so across several orders the
 * customer's total can differ by a point from adding up these per-order values.
 */
export function orderPoints(order: {
  subtotal: number;
  discountAmount: number;
  walletAmountUsed?: number;
  loyaltyTomanPerPoint?: number;
  paymentStatus: string;
  status: string;
}): number {
  if (order.paymentStatus !== "paid" || order.status === "cancelled") return 0;
  const tomanPerPoint = Math.max(1, order.loyaltyTomanPerPoint ?? DEFAULT_TOMAN_PER_POINT);
  return Math.floor(Math.max(0, order.subtotal - order.discountAmount - (order.walletAmountUsed ?? 0)) / tomanPerPoint);
}
