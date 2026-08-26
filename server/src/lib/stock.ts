import { prisma } from "./prisma.js";
import { env } from "./env.js";

/**
 * Decrements stock for confirmed order items. Only touches products/variants
 * that track finite stock (stock !== null) — unlimited-inventory items are
 * left alone. The `stock: { gte: quantity }` guard clamps at zero so two
 * concurrent orders can't push stock negative.
 */
export async function decrementStockForItems(
  items: { productId: string | null; variantId?: string | null; quantity: number }[],
): Promise<void> {
  const operations = items.flatMap((item) => {
    if (item.variantId) {
      return [
        prisma.productVariant.updateMany({
          where: { id: item.variantId, stock: { gte: item.quantity } },
          data: { stock: { decrement: item.quantity } },
        }),
      ];
    }
    if (!item.productId) return [];
    return [
      prisma.product.updateMany({
        where: { id: item.productId, stock: { gte: item.quantity } },
        data: { stock: { decrement: item.quantity } },
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
