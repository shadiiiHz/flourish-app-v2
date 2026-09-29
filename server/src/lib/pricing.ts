export const TAX_RATE = 0.1;

export function getDiscountedPrice(price: number, discountPercent?: number | null): number {
  if (!discountPercent) return price;
  return Math.round((price * (1 - discountPercent / 100)) / 1000) * 1000;
}

/**
 * The discount a product gets for the given order type: a preorderable
 * product's preorder discount (when the admin set one) replaces its regular
 * discount on preorders; otherwise the regular discount applies.
 */
export function getEffectiveDiscountPercent(
  product: { discountPercent: number | null; preorderDiscountPercent: number | null; allowPreorder: boolean },
  orderType: "instant" | "preorder",
): number | null {
  if (orderType === "preorder" && product.allowPreorder && product.preorderDiscountPercent != null) {
    return product.preorderDiscountPercent;
  }
  return product.discountPercent;
}
