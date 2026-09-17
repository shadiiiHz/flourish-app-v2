import { prisma } from "./prisma.js";
import { env } from "./env.js";

/**
 * Decrements stock for confirmed order items and records exactly how much
 * each item actually took in its `stockDecremented` column. Only touches
 * products/variants that track finite stock (stock !== null) — unlimited-
 * inventory items are left alone. The `stock: { gte: quantity }` guard means
 * an item already out of stock (or a concurrent order that emptied it first)
 * decrements nothing, which is why the actual amount taken must be recorded
 * per item rather than assumed to equal `quantity` — restockItems reads it
 * back later and must never hand back stock that was never taken.
 *
 * Always writes `stockDecremented` explicitly (0 or `quantity`), never only
 * on success — this function can run more than once for the same item (e.g.
 * an order un-cancelled back to an active status takes stock again), and a
 * stale value from an earlier call must not survive an attempt that fails.
 *
 * A variant's stock and its product's total are two separate columns that
 * `validateVariantStockSum` (see variantStock.ts) requires stay in sync
 * whenever the product tracks a total at all — so decrementing a variant
 * must decrement its product by the same amount, not just the variant.
 */
export async function decrementStockForItems(
  items: { id: string; productId: string | null; variantId?: string | null; quantity: number }[],
): Promise<void> {
  const relevant = items.filter((item) => item.variantId || item.productId);
  if (relevant.length === 0) return;
  await prisma.$transaction(async (tx) => {
    for (const item of relevant) {
      let decremented = 0;
      if (item.variantId) {
        const result = await tx.productVariant.updateMany({
          where: { id: item.variantId, stock: { gte: item.quantity } },
          data: { stock: { decrement: item.quantity } },
        });
        if (result.count > 0) {
          decremented = item.quantity;
          if (item.productId) {
            await tx.product.updateMany({
              where: { id: item.productId, stock: { gte: item.quantity } },
              data: { stock: { decrement: item.quantity } },
            });
          }
        }
      } else {
        const result = await tx.product.updateMany({
          where: { id: item.productId!, stock: { gte: item.quantity } },
          data: { stock: { decrement: item.quantity } },
        });
        if (result.count > 0) decremented = item.quantity;
      }
      await tx.orderItem.update({
        where: { id: item.id },
        data: { stockDecremented: decremented },
      });
    }
  });
  await revalidateStorefrontCatalog();
}

/**
 * Reverses decrementStockForItems — returns stock to products/variants for an
 * order that no longer holds it (cancelled or deleted). Restores exactly
 * `stockDecremented` per item (not `quantity`), so an item that never took
 * stock in the first place — out of stock at order time, or a preorder,
 * which are recorded as 0 — is correctly left untouched. Just like the
 * decrement, restoring a variant also restores its product's total, keeping
 * the two in sync.
 */
export async function restockItems(
  items: { productId: string | null; variantId?: string | null; stockDecremented: number }[],
): Promise<void> {
  const operations = items.flatMap((item) => {
    if (item.stockDecremented <= 0) return [];
    if (item.variantId) {
      const ops = [
        prisma.productVariant.updateMany({
          where: { id: item.variantId, stock: { not: null } },
          data: { stock: { increment: item.stockDecremented } },
        }),
      ];
      if (item.productId) {
        ops.push(
          prisma.product.updateMany({
            where: { id: item.productId, stock: { not: null } },
            data: { stock: { increment: item.stockDecremented } },
          }),
        );
      }
      return ops;
    }
    if (!item.productId) return [];
    return [
      prisma.product.updateMany({
        where: { id: item.productId, stock: { not: null } },
        data: { stock: { increment: item.stockDecremented } },
      }),
    ];
  });
  if (operations.length === 0) return;
  await prisma.$transaction(operations);
  await revalidateStorefrontCatalog();
}

/**
 * Purges the storefront's cached catalog (ISR, 60s window) right after stock
 * changes, so a just-sold-out product shows "ناموجود" immediately instead of
 * customers seeing stale availability for up to a minute. Best-effort — the
 * stock update itself already succeeded, so a failure here just means the
 * storefront falls back to its timed revalidation.
 */
async function revalidateStorefrontCatalog(): Promise<void> {
  if (!env.revalidateSecret) return;
  try {
    await fetch(`${env.appUrl}/api/revalidate?secret=${encodeURIComponent(env.revalidateSecret)}`, {
      method: "POST",
    });
  } catch (err) {
    console.error("Failed to revalidate storefront catalog after stock change:", err);
  }
}
