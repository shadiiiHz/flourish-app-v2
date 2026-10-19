import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { requireCustomerAuth } from "../middleware/requireCustomerAuth.js";
import { getDiscountedPrice, getEffectiveDiscountPercent } from "../lib/pricing.js";
import { parsePagination, paginatedResult } from "../lib/pagination.js";
import { normalizeAddonIds, resolveItemAddons, type ResolvedAddon } from "../lib/addons.js";
import { ensureBirthdayMessage } from "../lib/birthdayDiscount.js";
import { getLoyaltyStatus } from "../lib/loyalty.js";
import { stockGroupId, stockGroupInclude } from "../lib/stockGroups.js";
import type { Prisma } from "@prisma/client";

export const customersRouter = Router();

customersRouter.use(requireCustomerAuth);

const updateProfileSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  email: z.string().optional(),
  avatar: z.string().optional(),
  phone: z.string().min(5).optional(),
  /** ISO datetime string, or null to clear it. Only the month/day are used, for the birthday discount. */
  birthDate: z.string().datetime().nullable().optional(),
});

customersRouter.patch(
  "/me",
  asyncHandler(async (req, res) => {
    const parsed = updateProfileSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "اطلاعات معتبر نیست" });
      return;
    }
    const { birthDate, ...rest } = parsed.data;
    if (birthDate !== undefined) {
      const existing = await prisma.customer.findUnique({ where: { id: req.customer!.sub } });
      if (existing?.birthDate) {
        res.status(400).json({ error: "تاریخ تولد فقط یک‌بار قابل ثبت است و دیگر قابل ویرایش نیست" });
        return;
      }
    }
    try {
      const customer = await prisma.customer.update({
        where: { id: req.customer!.sub },
        data: {
          ...rest,
          ...(birthDate !== undefined ? { birthDate: birthDate ? new Date(birthDate) : null } : {}),
        },
      });
      if (birthDate) {
        await ensureBirthdayMessage(customer.id, customer.birthDate);
      }
      res.json({
        phone: customer.phone,
        hasPassword: !!customer.passwordHash,
        firstName: customer.firstName ?? undefined,
        lastName: customer.lastName ?? undefined,
        email: customer.email ?? undefined,
        avatar: customer.avatar ?? undefined,
        birthDate: customer.birthDate?.toISOString(),
        walletBalance: customer.walletBalance,
        onboardingCompleted: !!customer.onboardingCompletedAt,
      });
    } catch {
      res.status(409).json({ error: "این شماره موبایل قبلاً ثبت شده است" });
    }
  }),
);

customersRouter.post(
  "/me/onboarding/complete",
  asyncHandler(async (req, res) => {
    await prisma.customer.updateMany({
      where: { id: req.customer!.sub, onboardingCompletedAt: null },
      data: { onboardingCompletedAt: new Date() },
    });
    res.json({ ok: true });
  }),
);

customersRouter.get(
  "/me/orders",
  asyncHandler(async (req, res) => {
    const customerId = req.customer!.sub;
    const pagination = parsePagination(req);
    const [orders, total] = await prisma.$transaction([
      prisma.order.findMany({
        where: { customerId },
        include: { items: true },
        orderBy: { createdAt: "desc" },
        skip: pagination.skip,
        take: pagination.take,
      }),
      prisma.order.count({ where: { customerId } }),
    ]);
    res.json(paginatedResult(orders, total, pagination));
  }),
);

customersRouter.get(
  "/me/orders/:id",
  asyncHandler(async (req, res) => {
    const order = await prisma.order.findFirst({
      where: { id: req.params.id, customerId: req.customer!.sub },
      include: { items: true },
    });
    if (!order) {
      res.status(404).json({ error: "سفارش یافت نشد" });
      return;
    }
    res.json(order);
  }),
);

customersRouter.get(
  "/me/wallet",
  asyncHandler(async (req, res) => {
    const customerId = req.customer!.sub;
    const pagination = parsePagination(req);
    const [customer, transactions, total] = await prisma.$transaction([
      prisma.customer.findUnique({ where: { id: customerId }, select: { walletBalance: true } }),
      prisma.walletTransaction.findMany({
        where: { customerId },
        orderBy: { createdAt: "desc" },
        skip: pagination.skip,
        take: pagination.take,
      }),
      prisma.walletTransaction.count({ where: { customerId } }),
    ]);
    const loyalty = await getLoyaltyStatus(customerId);
    res.json({
      balance: customer?.walletBalance ?? 0,
      loyalty,
      transactions: paginatedResult(transactions, total, pagination),
    });
  }),
);

const addressSchema = z.object({
  title: z.string().optional(),
  address: z.string().min(1),
  details: z.string().optional(),
  phone: z.string().optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
  isDefault: z.boolean().optional(),
});

customersRouter.get(
  "/me/addresses",
  asyncHandler(async (req, res) => {
    const addresses = await prisma.address.findMany({
      where: { customerId: req.customer!.sub },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    });
    res.json(addresses);
  }),
);

customersRouter.post(
  "/me/addresses",
  asyncHandler(async (req, res) => {
    const parsed = addressSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "اطلاعات آدرس معتبر نیست" });
      return;
    }
    const customerId = req.customer!.sub;
    const { isDefault, ...data } = parsed.data;
    const address = await prisma.$transaction(async (tx) => {
      const existingCount = await tx.address.count({ where: { customerId } });
      const willBeDefault = existingCount === 0 || !!isDefault;
      if (willBeDefault) {
        await tx.address.updateMany({
          where: { customerId, isDefault: true },
          data: { isDefault: false },
        });
      }
      return tx.address.create({
        data: { ...data, isDefault: willBeDefault, customerId },
      });
    });
    res.status(201).json(address);
  }),
);

customersRouter.put(
  "/me/addresses/:id",
  asyncHandler(async (req, res) => {
    const parsed = addressSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "اطلاعات آدرس معتبر نیست" });
      return;
    }
    const customerId = req.customer!.sub;
    const { isDefault, ...data } = parsed.data;
    const address = await prisma.$transaction(async (tx) => {
      const totalCount = await tx.address.count({ where: { customerId } });
      const willBeDefault = totalCount === 1 || !!isDefault;
      if (willBeDefault) {
        await tx.address.updateMany({
          where: { customerId, isDefault: true, NOT: { id: req.params.id } },
          data: { isDefault: false },
        });
      }
      const { count } = await tx.address.updateMany({
        where: { id: req.params.id, customerId },
        data: { ...data, isDefault: willBeDefault },
      });
      if (count === 0) return null;
      return tx.address.findUnique({ where: { id: req.params.id } });
    });
    if (!address) {
      res.status(404).json({ error: "آدرس یافت نشد" });
      return;
    }
    res.json(address);
  }),
);

customersRouter.delete(
  "/me/addresses/:id",
  asyncHandler(async (req, res) => {
    const customerId = req.customer!.sub;
    const result = await prisma.$transaction(async (tx) => {
      const target = await tx.address.findFirst({
        where: { id: req.params.id, customerId },
      });
      if (!target) return "not-found" as const;
      if (target.isDefault) return "is-default" as const;
      const totalCount = await tx.address.count({ where: { customerId } });
      if (totalCount <= 1) return "last" as const;
      await tx.address.delete({ where: { id: target.id } });
      return "deleted" as const;
    });
    if (result === "not-found") {
      res.status(404).json({ error: "آدرس یافت نشد" });
      return;
    }
    if (result === "is-default") {
      res.status(409).json({ error: "آدرس پیش‌فرض قابل حذف نیست" });
      return;
    }
    if (result === "last") {
      res.status(409).json({ error: "حداقل یک آدرس باید ثبت باشد" });
      return;
    }
    res.status(204).end();
  }),
);

const cartItemInclude = {
  product: { include: { addons: { select: { addonId: true } }, ...stockGroupInclude } },
  variant: true,
} satisfies Prisma.CartItemInclude;

type CartItemWithRelations = Prisma.CartItemGetPayload<{ include: typeof cartItemInclude }>;

const orderTypeSchema = z.enum(["instant", "preorder"]);

/** Preorderable products carry unlimited inventory in preorder mode — stock only caps instant orders. */
function isUnlimitedInPreorder(orderType: z.infer<typeof orderTypeSchema>, allowPreorder: boolean) {
  return orderType === "preorder" && allowPreorder;
}

/**
 * The stock a cart line draws on: its variant's if it has one, else the product's. Null means unlimited.
 * Members of a stock group always use the product's own stock (the shared pool) — a dependent's
 * variants only mirror it, so a stale variant value must never override the pool.
 */
function rawStock(item: CartItemWithRelations): number | null {
  if (stockGroupId(item.product)) return item.product.stock;
  return item.variant ? item.variant.stock : item.product.stock;
}

/**
 * How many units this line may hold. Products linked through a stock group (a parent and its
 * dependents) share one pool, so the other lines in the same group eat into this line's limit.
 */
function remainingForItem(item: CartItemWithRelations, allItems: CartItemWithRelations[]): number | null {
  const stock = rawStock(item);
  if (stock == null) return null;
  const groupId = stockGroupId(item.product);
  if (!groupId) return stock;
  const others = allItems
    .filter((o) => o.id !== item.id && stockGroupId(o.product) === groupId)
    .reduce((sum, o) => sum + o.quantity, 0);
  return Math.max(0, stock - others);
}

function mapCartItem(
  item: CartItemWithRelations,
  addons: ResolvedAddon[],
  orderType: z.infer<typeof orderTypeSchema> = "instant",
  allItems: CartItemWithRelations[] = [item],
) {
  const basePrice = item.variant ? item.variant.price : item.product.price;
  const unlimited = isUnlimitedInPreorder(orderType, item.product.allowPreorder);
  return {
    id: item.id,
    productId: item.productId,
    variantId: item.variantId,
    title: item.product.title,
    variantTitle: item.variant?.title,
    // Base price only — each addon is its own priced row (the product discount doesn't apply to addons).
    price: getDiscountedPrice(basePrice, getEffectiveDiscountPercent(item.product, orderType)),
    addons,
    addonIds: addons.map((addon) => addon.id),
    image: item.variant?.image ?? item.product.images[0],
    quantity: item.quantity,
    maxQuantity: unlimited ? null : remainingForItem(item, allItems),
    /** Id shared by every product drawing on the same stock pool, or null when this one stands alone. */
    stockGroupId: stockGroupId(item.product),
    /** The whole pool this line draws on (before other lines' share is subtracted); null means unlimited. */
    stockPool: unlimited ? null : rawStock(item),
    pickupOnly: item.product.pickupOnly,
    allowPreorder: item.product.allowPreorder,
    preorderWeekdays: item.product.preorderWeekdays,
  };
}

customersRouter.get(
  "/me/cart",
  asyncHandler(async (req, res) => {
    const orderType = orderTypeSchema.catch("instant").parse(req.query.orderType);
    const items = await prisma.cartItem.findMany({
      where: { customerId: req.customer!.sub },
      include: cartItemInclude,
      orderBy: { createdAt: "asc" },
    });
    const addons = await resolveItemAddons(items);
    res.json(items.map((item, index) => mapCartItem(item, addons[index], orderType, items)));
  }),
);

const addCartItemSchema = z.object({
  productId: z.string().min(1),
  variantId: z.string().optional(),
  quantity: z.number().int().positive().optional(),
  addonIds: z.array(z.string().min(1)).optional(),
  orderType: orderTypeSchema.optional().default("instant"),
});

customersRouter.post(
  "/me/cart",
  asyncHandler(async (req, res) => {
    const parsed = addCartItemSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "اطلاعات نامعتبر است" });
      return;
    }
    const customerId = req.customer!.sub;
    const { productId, variantId, quantity = 1, orderType } = parsed.data;
    const addonIds = normalizeAddonIds(parsed.data.addonIds);

    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: { variants: true, addons: { select: { addonId: true } }, ...stockGroupInclude },
    });
    if (!product) {
      res.status(404).json({ error: "محصول یافت نشد" });
      return;
    }
    const variant = variantId ? product.variants.find((v) => v.id === variantId) : undefined;
    if (variantId && !variant) {
      res.status(404).json({ error: "نوع محصول یافت نشد" });
      return;
    }
    const offeredAddonIds = new Set(product.addons.map((a) => a.addonId));
    if (addonIds.some((id) => !offeredAddonIds.has(id))) {
      res.status(400).json({ error: "افزودنی انتخاب‌شده برای این محصول معتبر نیست" });
      return;
    }
    const unlimited = isUnlimitedInPreorder(orderType, product.allowPreorder);
    const groupId = stockGroupId(product);
    // Members of a stock group draw on the product's pool, not on their (mirrored) variant stock.
    const pool = unlimited ? null : variant && !groupId ? variant.stock : product.stock;

    const item = await prisma.$transaction(async (tx) => {
      // The same product with a different set of addons is a separate cart line.
      const existing = await tx.cartItem.findFirst({
        where: { customerId, productId, variantId: variantId ?? null, addonIds: { equals: addonIds } },
      });
      // Units of the shared stock pool already held by the customer's other lines in this group.
      let heldByOthers = 0;
      if (pool != null && groupId) {
        const cart = await tx.cartItem.findMany({
          where: { customerId },
          select: { id: true, quantity: true, product: { select: { id: true, stockSourceId: true, ...stockGroupInclude } } },
        });
        heldByOthers = cart
          .filter((c) => c.id !== existing?.id && stockGroupId(c.product) === groupId)
          .reduce((sum, c) => sum + c.quantity, 0);
      }
      const maxQuantity = pool == null ? null : Math.max(0, pool - heldByOthers);
      const nextQuantity = (existing?.quantity ?? 0) + quantity;
      const clamped = maxQuantity != null ? Math.min(nextQuantity, maxQuantity) : nextQuantity;
      if (clamped < 1) return null;
      if (existing) {
        return tx.cartItem.update({
          where: { id: existing.id },
          data: { quantity: clamped },
          include: cartItemInclude,
        });
      }
      return tx.cartItem.create({
        data: { customerId, productId, variantId, addonIds, quantity: clamped },
        include: cartItemInclude,
      });
    });
    if (!item) {
      res.status(409).json({ error: "موجودی این محصول به پایان رسیده یا در سبد شما به سقف رسیده است" });
      return;
    }
    // Reload the whole cart: this line's limit depends on its group-mates' quantities.
    const cart = await prisma.cartItem.findMany({ where: { customerId }, include: cartItemInclude });
    const [addons] = await resolveItemAddons([item]);
    res.status(201).json(mapCartItem(item, addons, orderType, cart));
  }),
);

const updateCartItemSchema = z.object({
  quantity: z.number().int(),
  orderType: orderTypeSchema.optional().default("instant"),
});

customersRouter.put(
  "/me/cart/:id",
  asyncHandler(async (req, res) => {
    const parsed = updateCartItemSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "اطلاعات نامعتبر است" });
      return;
    }
    const customerId = req.customer!.sub;
    const existing = await prisma.cartItem.findFirst({
      where: { id: req.params.id, customerId },
      include: cartItemInclude,
    });
    if (!existing) {
      res.status(404).json({ error: "آیتم سبد خرید یافت نشد" });
      return;
    }
    if (parsed.data.quantity <= 0) {
      await prisma.cartItem.delete({ where: { id: existing.id } });
      res.status(204).end();
      return;
    }
    const { orderType } = parsed.data;
    const unlimited = isUnlimitedInPreorder(orderType, existing.product.allowPreorder);
    const cart = await prisma.cartItem.findMany({ where: { customerId }, include: cartItemInclude });
    const maxQuantity = unlimited ? null : remainingForItem(existing, cart);
    const clamped = maxQuantity != null ? Math.min(parsed.data.quantity, maxQuantity) : parsed.data.quantity;
    if (clamped < 1) {
      res.status(409).json({ error: "موجودی این محصول به پایان رسیده یا در سبد شما به سقف رسیده است" });
      return;
    }
    const updated = await prisma.cartItem.update({
      where: { id: existing.id },
      data: { quantity: clamped },
      include: cartItemInclude,
    });
    const [addons] = await resolveItemAddons([updated]);
    res.json(
      mapCartItem(updated, addons, orderType, cart.map((c) => (c.id === updated.id ? updated : c))),
    );
  }),
);

customersRouter.delete(
  "/me/cart/:id",
  asyncHandler(async (req, res) => {
    const { count } = await prisma.cartItem.deleteMany({
      where: { id: req.params.id, customerId: req.customer!.sub },
    });
    if (count === 0) {
      res.status(404).json({ error: "آیتم سبد خرید یافت نشد" });
      return;
    }
    res.status(204).end();
  }),
);

customersRouter.delete(
  "/me/cart",
  asyncHandler(async (req, res) => {
    await prisma.cartItem.deleteMany({ where: { customerId: req.customer!.sub } });
    res.status(204).end();
  }),
);
