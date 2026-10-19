import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma.js";
import { env } from "./env.js";

type Db = Prisma.TransactionClient;

/** The database is remote, so stock transactions (many small queries) can outlast Prisma's 5s default. */
const LONG_TRANSACTION = { timeout: 30_000, maxWait: 10_000 };

/** productId → its parent's id, for the dependent products among `productIds` (one query, outside any transaction). */
async function loadStockSources(productIds: (string | null)[]): Promise<Map<string, string>> {
  const ids = [...new Set(productIds.filter((id): id is string => !!id))];
  if (ids.length === 0) return new Map();
  const products = await prisma.product.findMany({
    where: { id: { in: ids }, stockSourceId: { not: null } },
    select: { id: true, stockSourceId: true },
  });
  return new Map(products.map((p) => [p.id, p.stockSourceId as string]));
}

/**
 * A dependent product (stockSourceId set) has no inventory of its own: its
 * `stock` column is just a 1:1 mirror of its parent's. Every code path that
 * changes a parent's stock must call this afterwards so the mirrors — which
 * the storefront, cart and admin filters read as ordinary stock — never drift.
 */
export async function syncDependentStock(db: Db, parentIds: Iterable<string>): Promise<void> {
  for (const parentId of new Set(parentIds)) {
    const parent = await db.product.findUnique({ where: { id: parentId }, select: { stock: true } });
    if (!parent) continue;
    await db.product.updateMany({
      where: { stockSourceId: parentId },
      data: { stock: parent.stock },
    });
    // A dependent's variants are sold 1:1 against the same parent stock, so each mirrors it too.
    await db.productVariant.updateMany({
      where: { product: { stockSourceId: parentId } },
      data: { stock: parent.stock },
    });
  }
}

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
  const sourceByProduct = await loadStockSources(relevant.map((i) => i.productId));
  await prisma.$transaction(async (tx) => {
    const changedParents = new Set<string>();
    for (const item of relevant) {
      let decremented = 0;
      // A dependent product (with or without variants) takes its stock from its
      // parent instead of itself; its own product/variant stock is just a mirror.
      const dependentSourceId = item.productId ? sourceByProduct.get(item.productId) : null;
      if (dependentSourceId) {
        const result = await tx.product.updateMany({
          where: { id: dependentSourceId, stock: { gte: item.quantity } },
          data: { stock: { decrement: item.quantity } },
        });
        if (result.count > 0) {
          decremented = item.quantity;
          changedParents.add(dependentSourceId);
        }
      } else if (item.variantId) {
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
        if (result.count > 0) {
          decremented = item.quantity;
          // Could itself be a parent whose dependents mirror it.
          changedParents.add(item.productId!);
        }
      }
      await tx.orderItem.update({
        where: { id: item.id },
        data: { stockDecremented: decremented },
      });
    }
    await syncDependentStock(tx, changedParents);
  }, LONG_TRANSACTION);
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
  const relevant = items.filter((item) => item.stockDecremented > 0);
  if (relevant.length === 0) return;
  const sourceByProduct = await loadStockSources(relevant.map((i) => i.productId));
  await prisma.$transaction(async (tx) => {
    const changedParents = new Set<string>();
    for (const item of relevant) {
      // A dependent product's stock lives on its parent (even for its variants), so give it back there.
      const sourceId = item.productId ? sourceByProduct.get(item.productId) : null;
      if (sourceId) {
        await tx.product.updateMany({
          where: { id: sourceId, stock: { not: null } },
          data: { stock: { increment: item.stockDecremented } },
        });
        changedParents.add(sourceId);
        continue;
      }
      if (item.variantId) {
        await tx.productVariant.updateMany({
          where: { id: item.variantId, stock: { not: null } },
          data: { stock: { increment: item.stockDecremented } },
        });
        if (item.productId) {
          await tx.product.updateMany({
            where: { id: item.productId, stock: { not: null } },
            data: { stock: { increment: item.stockDecremented } },
          });
        }
        continue;
      }
      if (!item.productId) continue;
      await tx.product.updateMany({
        where: { id: item.productId, stock: { not: null } },
        data: { stock: { increment: item.stockDecremented } },
      });
      changedParents.add(item.productId);
    }
    await syncDependentStock(tx, changedParents);
  }, LONG_TRANSACTION);
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
