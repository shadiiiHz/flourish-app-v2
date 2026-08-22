export const TAX_RATE = 0.1;

export function getDiscountedPrice(price: number, discountPercent?: number | null): number {
  if (!discountPercent) return price;
  return Math.round((price * (1 - discountPercent / 100)) / 1000) * 1000;
}
