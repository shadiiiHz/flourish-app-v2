import { prisma } from "./prisma.js";

export interface ResolvedAddon {
  id: string;
  name: string;
  price: number;
}

/** Addon ids in a canonical order (sorted, de-duplicated) so equal selections compare equal. */
export function normalizeAddonIds(ids: readonly string[] | undefined): string[] {
  return [...new Set(ids ?? [])].sort();
}

export function sumAddonPrices(addons: readonly { price: number }[]): number {
  return addons.reduce((sum, addon) => sum + addon.price, 0);
}

/**
 * Resolves each line's ticked addon ids into live addon records, in one query.
 * Ids of addons that were deleted, or that the product no longer offers, are
 * dropped — the admin can change what a product offers after a customer has
 * already put it in their cart.
 */
export async function resolveItemAddons(
  items: { addonIds: string[]; product: { addons: { addonId: string }[] } }[],
): Promise<ResolvedAddon[][]> {
  const wanted = [...new Set(items.flatMap((item) => item.addonIds))];
  if (wanted.length === 0) return items.map(() => []);

  const addons = await prisma.addon.findMany({
    where: { id: { in: wanted } },
    select: { id: true, name: true, price: true },
  });
  const byId = new Map(addons.map((addon) => [addon.id, addon]));

  return items.map((item) => {
    const offered = new Set(item.product.addons.map((a) => a.addonId));
    return item.addonIds
      .filter((id) => offered.has(id))
      .map((id) => byId.get(id))
      .filter((addon): addon is ResolvedAddon => !!addon);
  });
}
