/**
 * A stock group is a parent product together with the dependents that draw from
 * its stock 1:1 (see Product.stockSourceId). Everything in a group shares one
 * pool — the parent's stock, which each dependent (and each of its variants)
 * mirrors — so what a customer holds across ALL of them can't exceed it.
 */

/** Includes a product needs so `stockGroupId` can tell whether it is a parent. */
export const stockGroupInclude = { _count: { select: { stockDependents: true } } } as const;

/**
 * The id shared by every member of the product's stock group, or null when the
 * product isn't linked to any (then it only ever competes with itself).
 * Pass a product loaded with `stockGroupInclude` so parents are recognised.
 */
export function stockGroupId(product: {
  id: string;
  stockSourceId: string | null;
  _count?: { stockDependents: number };
}): string | null {
  if (product.stockSourceId) return product.stockSourceId;
  return (product._count?.stockDependents ?? 0) > 0 ? product.id : null;
}
