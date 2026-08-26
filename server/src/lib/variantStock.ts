/**
 * Enforces that when a product has a finite total stock (not null/unlimited)
 * and has variants, the admin's per-variant stock split must add up exactly
 * to that total — no variant can be left "unlimited" (null) in that case.
 * A product with no stock limit at all, or no variants, is unrestricted as
 * before. Returns an error message to show/reject with, or null if fine.
 */
export function validateVariantStockSum(
  productStock: number | null | undefined,
  variants: { stock?: number | null }[],
): string | null {
  if (productStock == null || variants.length === 0) return null;

  const missing = variants.some((v) => v.stock == null);
  if (missing) {
    return "چون موجودی کل محصول مشخص شده، باید برای همهٔ انواع هم موجودی مشخص کنید (نامحدود مجاز نیست)";
  }

  const sum = variants.reduce((total, v) => total + (v.stock ?? 0), 0);
  if (sum !== productStock) {
    return `مجموع موجودی انواع (${sum}) باید دقیقاً با موجودی کل محصول (${productStock}) برابر باشد`;
  }

  return null;
}
