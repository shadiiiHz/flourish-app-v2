import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { requireCustomerAuth } from "../middleware/requireCustomerAuth.js";
import { getDiscountedPrice } from "../lib/pricing.js";
import { parsePagination, paginatedResult } from "../lib/pagination.js";
import type { Prisma } from "@prisma/client";

export const customersRouter = Router();

customersRouter.use(requireCustomerAuth);

const updateProfileSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  email: z.string().optional(),
  avatar: z.string().optional(),
  phone: z.string().min(5).optional(),
});

customersRouter.patch(
  "/me",
  asyncHandler(async (req, res) => {
    const parsed = updateProfileSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "اطلاعات معتبر نیست" });
      return;
    }
    try {
      const customer = await prisma.customer.update({
        where: { id: req.customer!.sub },
        data: parsed.data,
      });
      res.json({
        phone: customer.phone,
        hasPassword: !!customer.passwordHash,
        firstName: customer.firstName ?? undefined,
        lastName: customer.lastName ?? undefined,
        email: customer.email ?? undefined,
        avatar: customer.avatar ?? undefined,
        walletBalance: customer.walletBalance,
      });
    } catch {
      res.status(409).json({ error: "این شماره موبایل قبلاً ثبت شده است" });
    }
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
    res.json({
      balance: customer?.walletBalance ?? 0,
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
  product: true,
  variant: true,
} satisfies Prisma.CartItemInclude;

type CartItemWithRelations = Prisma.CartItemGetPayload<{ include: typeof cartItemInclude }>;

const orderTypeSchema = z.enum(["instant", "preorder"]);

/** Preorderable products carry unlimited inventory in preorder mode — stock only caps instant orders. */
function isUnlimitedInPreorder(orderType: z.infer<typeof orderTypeSchema>, allowPreorder: boolean) {
  return orderType === "preorder" && allowPreorder;
}

function mapCartItem(item: CartItemWithRelations, orderType: z.infer<typeof orderTypeSchema> = "instant") {
  const basePrice = item.variant ? item.variant.price : item.product.price;
  const unlimited = isUnlimitedInPreorder(orderType, item.product.allowPreorder);
  return {
    id: item.id,
    productId: item.productId,
    variantId: item.variantId,
    title: item.product.title,
    variantTitle: item.variant?.title,
    price: getDiscountedPrice(basePrice, item.product.discountPercent),
    image: item.variant?.image ?? item.product.images[0],
    quantity: item.quantity,
    maxQuantity: unlimited ? null : item.variant ? item.variant.stock : item.product.stock,
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
    res.json(items.map((item) => mapCartItem(item, orderType)));
  }),
);

const addCartItemSchema = z.object({
  productId: z.string().min(1),
  variantId: z.string().optional(),
  quantity: z.number().int().positive().optional(),
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

    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: { variants: true },
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
    const unlimited = isUnlimitedInPreorder(orderType, product.allowPreorder);
    const maxQuantity = unlimited ? null : variant ? variant.stock : product.stock;

    const item = await prisma.$transaction(async (tx) => {
      const existing = await tx.cartItem.findFirst({
        where: { customerId, productId, variantId: variantId ?? null },
      });
      const nextQuantity = (existing?.quantity ?? 0) + quantity;
      const clamped = maxQuantity != null ? Math.min(nextQuantity, maxQuantity) : nextQuantity;
      if (existing) {
        return tx.cartItem.update({
          where: { id: existing.id },
          data: { quantity: clamped },
          include: cartItemInclude,
        });
      }
      return tx.cartItem.create({
        data: { customerId, productId, variantId, quantity: clamped },
        include: cartItemInclude,
      });
    });
    res.status(201).json(mapCartItem(item, orderType));
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
    const maxQuantity = unlimited
      ? null
      : existing.variant
        ? existing.variant.stock
        : existing.product.stock;
    const clamped = maxQuantity != null ? Math.min(parsed.data.quantity, maxQuantity) : parsed.data.quantity;
    const updated = await prisma.cartItem.update({
      where: { id: existing.id },
      data: { quantity: clamped },
      include: cartItemInclude,
    });
    res.json(mapCartItem(updated, orderType));
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
