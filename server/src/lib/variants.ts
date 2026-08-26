import type { Prisma, PrismaClient } from "@prisma/client";

interface IncomingVariant {
  id?: string;
  title: string;
  description?: string | null;
  price: number;
  weight?: string | null;
  stock?: number | null;
  image?: string | null;
}

/**
 * Updates a product's variants in place instead of deleting and recreating
 * all of them on every save. A naive delete-all-then-create-all approach
 * assigns every variant a brand new id on every edit — even edits that don't
 * touch variants at all, since the admin forms always resend the full list —
 * which cascade-deletes any customer's CartItem still pointing at the old
 * variant id (CartItem.variant has onDelete: Cascade). Matching by id and
 * updating in place keeps those references alive; only variants the admin
 * actually removed from the list get deleted (and their CartItems with them,
 * which is correct — that variant no longer exists to buy).
 */
export async function syncProductVariants(
  tx: Prisma.TransactionClient | PrismaClient,
  productId: string,
  previousVariantIds: string[],
  incoming: IncomingVariant[],
): Promise<void> {
  const previousIds = new Set(previousVariantIds);
  const incomingIds = new Set(incoming.filter((v) => v.id).map((v) => v.id!));

  const toDelete = previousVariantIds.filter((id) => !incomingIds.has(id));
  if (toDelete.length > 0) {
    await tx.productVariant.deleteMany({ where: { id: { in: toDelete } } });
  }

  for (const { id, ...rest } of incoming) {
    if (id && previousIds.has(id)) {
      await tx.productVariant.update({ where: { id }, data: rest });
    } else {
      await tx.productVariant.create({ data: { ...rest, productId } });
    }
  }
}
