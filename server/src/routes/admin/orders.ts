import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { asyncHandler } from "../../lib/asyncHandler.js";
import { parsePagination, parseSearch, paginatedResult } from "../../lib/pagination.js";
import {
  creditWalletCashback,
  getOutstandingOrderCashback,
  getRetainedOrderCashback,
  redeemWallet,
  refundWalletHold,
  reverseWalletCashback,
} from "../../lib/wallet.js";
import { notifyLoyaltyUpgrade } from "../../lib/loyaltyUpgradeSms.js";
import { calculateShipping } from "../../lib/shipping.js";
import { TAX_RATE, getDiscountedPrice, getEffectiveDiscountPercent } from "../../lib/pricing.js";
import { decrementStockForItems, restockItems } from "../../lib/stock.js";
import { stockGroupId, stockGroupInclude } from "../../lib/stockGroups.js";

export const adminOrdersRouter = Router();

const ORDER_STATUSES = [
  "pending",
  "confirmed",
  "preparing",
  "ready",
  "delivered",
  "cancelled",
] as const;

adminOrdersRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    const search = parseSearch(req);
    const customerId = typeof req.query.customerId === "string" ? req.query.customerId : undefined;

    const conditions = [];
    if (status && (ORDER_STATUSES as readonly string[]).includes(status)) {
      conditions.push({ status: status as (typeof ORDER_STATUSES)[number] });
    }
    if (customerId) {
      conditions.push({ customerId });
    }
    if (search) {
      const or: object[] = [
        { customerName: { contains: search, mode: "insensitive" as const } },
        { customerPhone: { contains: search, mode: "insensitive" as const } },
        { id: { contains: search, mode: "insensitive" as const } },
      ];
      // Order numbers are searched as "FL-000123", "000123", or plain "123" — strip
      // everything but digits and match the underlying integer (orderNumber is an Int
      // column, so this can't be a Prisma `contains` the way the string fields above are).
      const orderNumberDigits = search.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
      if (orderNumberDigits) {
        const orderNumber = Number(orderNumberDigits);
        if (Number.isSafeInteger(orderNumber)) {
          or.push({ orderNumber });
        }
      }
      conditions.push({ OR: or });
    }
    const where = conditions.length > 0 ? { AND: conditions } : undefined;

    const pagination = parsePagination(req);
    const [orders, total] = await prisma.$transaction([
      prisma.order.findMany({
        where,
        include: {
          items: true,
          customer: true,
          address: { select: { lat: true, lng: true } },
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: pagination.skip,
        take: pagination.take,
      }),
      prisma.order.count({ where }),
    ]);
    res.json(paginatedResult(orders, total, pagination));
  }),
);

const orderItemInputSchema = z
  .object({
    productId: z.string().min(1).optional(),
    variantId: z.string().optional(),
    quantity: z.number().int().positive(),
    /** Keeps a line's recorded price instead of re-pricing it from the current catalog — used when editing an existing order. */
    unitPrice: z.number().int().nonnegative().optional(),
    /** Only for lines without a catalog product (e.g. the product was since deleted). */
    title: z.string().min(1).optional(),
    variantTitle: z.string().optional(),
  })
  .refine((item) => !!item.productId || (!!item.title && item.unitPrice != null), {
    message: "اطلاعات یکی از آیتم‌ها ناقص است",
  });

const createOrderSchema = z
  .object({
    customerId: z.string().min(1),
    items: z.array(orderItemInputSchema).optional(),
    /** Bypasses picking real products entirely — a single generic line item is created at this price. */
    manualSubtotal: z.number().int().positive().optional(),
    deliveryMethod: z.enum(["delivery", "pickup"]).default("delivery"),
    addressId: z.string().optional(),
    addressText: z.string().optional(),
    shippingCost: z.number().int().nonnegative().optional(),
    discountCode: z.string().trim().min(1).optional(),
    /** Toman amount to redeem from the customer's wallet — clamped below at their balance and the order total. Omit/0 to skip the wallet. */
    walletAmount: z.number().int().nonnegative().optional(),
    paymentStatus: z.enum(["pending", "paid"]).default("paid"),
    customerName: z.string().optional(),
    note: z.string().optional(),
    /** "preorder" skips stock entirely, same as a customer preorder. */
    orderType: z.enum(["instant", "preorder"]).default("instant"),
  })
  .refine((data) => (data.items && data.items.length > 0) || data.manualSubtotal != null, {
    message: "حداقل یک آیتم اضافه کنید یا جمع کل اقلام را وارد کنید",
  })
  .refine((data) => data.deliveryMethod !== "delivery" || !!data.addressId || !!data.addressText, {
    message: "برای ارسال باید یک آدرس (ثبت‌شده یا دستی) مشخص شود",
  });

type CreateOrderInput = z.infer<typeof createOrderSchema>;

interface OrderDraft {
  customer: NonNullable<Awaited<ReturnType<typeof prisma.customer.findUnique>>>;
  appliedDiscount: { id: string; code: string; percent: number; isPersonal: boolean } | null;
  orderItems: {
    productId?: string;
    variantId?: string;
    title: string;
    variantTitle?: string;
    price: number;
    quantity: number;
  }[];
  fields: {
    customerName?: string;
    note?: string;
    orderType: "instant" | "preorder";
    deliveryMethod: "delivery" | "pickup";
    addressId?: string;
    addressText?: string;
    distanceKm?: number;
    subtotal: number;
    discountCode?: string;
    discountAmount: number;
    tax: number;
    shippingCost: number;
    total: number;
    walletAmountUsed: number;
    paymentStatus: "pending" | "paid";
  };
}

/**
 * Products linked through a stock relation (a parent and its dependents) share one stock pool, so the
 * order's lines across the whole group can't total more than it. `heldByOrder` is what an order being
 * edited already holds (it is restocked before the new version is applied).
 */
async function assertStockGroupsHaveRoom(
  orderItems: OrderDraft["orderItems"],
  heldByOrder: { productId: string | null; stockDecremented: number }[],
) {
  const ids = [
    ...new Set(
      [...orderItems.map((i) => i.productId), ...heldByOrder.map((i) => i.productId)].filter(
        (id): id is string => !!id,
      ),
    ),
  ];
  if (ids.length === 0) return;
  const products = await prisma.product.findMany({
    where: { id: { in: ids } },
    select: { id: true, title: true, stock: true, stockSourceId: true, ...stockGroupInclude },
  });
  const byId = new Map(products.map((p) => [p.id, p]));
  const groups = new Map<string, { pool: number; ordered: number; titles: string[] }>();
  for (const item of orderItems) {
    const product = item.productId ? byId.get(item.productId) : undefined;
    const groupId = product ? stockGroupId(product) : null;
    if (!product || !groupId || product.stock == null) continue;
    const group = groups.get(groupId) ?? { pool: product.stock, ordered: 0, titles: [] };
    group.ordered += item.quantity;
    if (!group.titles.includes(product.title)) group.titles.push(product.title);
    groups.set(groupId, group);
  }
  for (const held of heldByOrder) {
    const product = held.productId ? byId.get(held.productId) : undefined;
    const group = product ? groups.get(stockGroupId(product) ?? "") : undefined;
    if (group) group.pool += held.stockDecremented;
  }
  const overdrawn = [...groups.values()].find((g) => g.ordered > g.pool);
  if (overdrawn) {
    const names = overdrawn.titles.map((t) => `«${t}»`).join("، ");
    throw new DraftError(
      400,
      `موجودی کافی نیست؛ از مجموع ${names} حداکثر ${overdrawn.pool} عدد قابل سفارش است`,
    );
  }
}

class DraftError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/**
 * Validates an admin order payload and works out everything that will be
 * stored (line items, discount, tax, shipping, wallet usage) without writing
 * anything — shared by order creation and order editing so both price orders
 * by exactly the same rules. Throws DraftError for any invalid input.
 *
 * When editing, `existing` is the order being replaced: its already-consumed
 * personal discount code stays usable, and the wallet amount it currently
 * holds counts as available again (it is refunded before the new one is taken).
 */
async function buildOrderDraft(
  data: CreateOrderInput,
  existing?: {
    id?: string;
    discountCode: string | null;
    walletAmountUsed: number;
    /** The order being replaced: the stock it holds returns to the pool, so it counts as available to the new version. */
    items?: { productId: string | null; stockDecremented: number }[];
  },
): Promise<OrderDraft> {
  const {
    customerId,
    items,
    manualSubtotal,
    deliveryMethod,
    addressId,
    addressText,
    shippingCost: manualShippingCost,
    discountCode,
    walletAmount,
    paymentStatus,
    customerName,
    note,
    orderType,
  } = data;

  const customer = await prisma.customer.findUnique({ where: { id: customerId } });
  if (!customer) throw new DraftError(404, "مشتری یافت نشد");

  let appliedDiscount: OrderDraft["appliedDiscount"] = null;
  if (discountCode) {
    const discount = await prisma.discountCode.findUnique({
      where: { code: discountCode.toUpperCase() },
    });
    if (!discount || !discount.isActive) {
      // A personal code this very order already consumed is deactivated, but stays valid for it.
      const keptByThisOrder = !!discount && !!existing && existing.discountCode === discount.code;
      if (!keptByThisOrder) throw new DraftError(400, "کد تخفیف معتبر نیست");
    }
    if (discount!.customerId && discount!.customerId !== customerId) {
      throw new DraftError(400, "این کد تخفیف مخصوص این مشتری نیست");
    }
    if (discount!.usedAt && existing?.discountCode !== discount!.code) {
      throw new DraftError(400, "این کد تخفیف قبلاً استفاده شده است");
    }
    if (
      discount!.expiresAt &&
      discount!.expiresAt.getTime() < Date.now() &&
      existing?.discountCode !== discount!.code
    ) {
      throw new DraftError(400, "این کد تخفیف منقضی شده است");
    }
    appliedDiscount = {
      id: discount!.id,
      code: discount!.code,
      percent: discount!.percent,
      isPersonal: !!discount!.customerId,
    };
  }

  const orderItems: OrderDraft["orderItems"] = [];

  if (manualSubtotal != null) {
    // Admin chose to skip picking real products and just entered a total.
    orderItems.push({
      title: "اقلام سفارش (بدون جزئیات)",
      price: manualSubtotal,
      quantity: 1,
    });
  } else {
    const catalogItems = items!.filter((i) => i.productId);
    const productIds = [...new Set(catalogItems.map((i) => i.productId!))];
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      include: { variants: true },
    });
    const productById = new Map(products.map((p) => [p.id, p]));

    if (deliveryMethod === "delivery") {
      const pickupOnlyTitles = [
        ...new Set(
          catalogItems
            .map((item) => productById.get(item.productId!))
            .filter((p) => p?.pickupOnly)
            .map((p) => p!.title),
        ),
      ];
      if (pickupOnlyTitles.length > 0) {
        const names = pickupOnlyTitles.map((t) => `«${t}»`).join("، ");
        const verb = pickupOnlyTitles.length > 1 ? "هستند" : "است";
        throw new DraftError(400, `${names} فقط با تحویل حضوری قابل سفارش ${verb}`);
      }
    }

    for (const item of items!) {
      if (!item.productId) {
        orderItems.push({
          title: item.title!,
          variantTitle: item.variantTitle,
          price: item.unitPrice!,
          quantity: item.quantity,
        });
        continue;
      }
      const product = productById.get(item.productId);
      if (!product) throw new DraftError(400, "یکی از محصولات انتخاب‌شده یافت نشد");
      const variant = item.variantId
        ? product.variants.find((v) => v.id === item.variantId)
        : undefined;
      if (item.variantId && !variant) {
        throw new DraftError(400, `نوع انتخاب‌شده برای «${product.title}» یافت نشد`);
      }
      const basePrice = variant ? variant.price : product.price;
      orderItems.push({
        productId: product.id,
        variantId: variant?.id,
        title: product.title,
        variantTitle: variant?.title,
        price:
          item.unitPrice ??
          getDiscountedPrice(basePrice, getEffectiveDiscountPercent(product, orderType)),
        quantity: item.quantity,
      });
    }
  }

  if (manualSubtotal == null && orderType === "instant") {
    await assertStockGroupsHaveRoom(orderItems, existing?.items ?? []);
  }

  const subtotal = orderItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const discountAmount = appliedDiscount
    ? Math.round((subtotal * appliedDiscount.percent) / 100)
    : 0;
  const tax = Math.round((subtotal - discountAmount) * TAX_RATE);

  let address: Awaited<ReturnType<typeof prisma.address.findFirst>> = null;
  let distanceKm: number | undefined;
  let finalShippingCost = 0;
  let finalAddressText: string | undefined;

  if (deliveryMethod === "delivery") {
    if (addressId) {
      address = await prisma.address.findFirst({ where: { id: addressId, customerId } });
      if (!address) throw new DraftError(404, "آدرس یافت نشد");
      if (address.lat != null && address.lng != null) {
        const shippingResult = await calculateShipping(address.lat, address.lng);
        if (shippingResult.outOfRange) {
          throw new DraftError(400, "این آدرس خارج از محدوده سرویس‌دهی فلوریش است");
        }
        distanceKm = shippingResult.distanceKm;
        finalShippingCost = shippingResult.shippingCost;
      } else {
        finalShippingCost = manualShippingCost ?? 0;
      }
      finalAddressText = [address.address, address.details].filter(Boolean).join(" — ");
    } else {
      finalAddressText = addressText;
      finalShippingCost = manualShippingCost ?? 0;
    }
  } else {
    finalAddressText = "مراجعه حضوری به فلوریش";
  }

  const total = subtotal - discountAmount + tax + finalShippingCost;

  let walletAmountUsed = 0;
  if (walletAmount && walletAmount > 0) {
    // While editing, this order's own held wallet money comes back and its own
    // still-unspent cashback goes away, so the "previous state" balance is neither.
    const availableWallet = Math.max(
      0,
      customer.walletBalance +
        (existing?.walletAmountUsed ?? 0) -
        (existing?.id ? await getOutstandingOrderCashback(existing.id) : 0),
    );
    walletAmountUsed = Math.min(walletAmount, availableWallet, total);
  }

  return {
    customer,
    appliedDiscount,
    orderItems,
    fields: {
      customerName:
        customerName ||
        [customer.firstName, customer.lastName].filter(Boolean).join(" ") ||
        undefined,
      note,
      orderType,
      deliveryMethod,
      addressId: address?.id,
      addressText: finalAddressText,
      distanceKm,
      subtotal,
      discountCode: appliedDiscount?.code,
      discountAmount,
      tax,
      shippingCost: finalShippingCost,
      total,
      walletAmountUsed,
      paymentStatus,
    },
  };
}

/**
 * Manual, in-person/phone order entry for the admin panel — bypasses the
 * cart + Zarinpal flow entirely (products/quantities are chosen directly,
 * and the admin decides payment status up front), but reuses the same
 * pricing/discount/shipping/wallet rules as customer checkout so totals
 * stay consistent between the two paths.
 */
adminOrdersRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const parsed = createOrderSchema.safeParse(req.body);
    if (!parsed.success) {
      res
        .status(400)
        .json({ error: parsed.error.issues[0]?.message ?? "اطلاعات سفارش نامعتبر است" });
      return;
    }

    let draft: OrderDraft;
    try {
      draft = await buildOrderDraft(parsed.data);
    } catch (err) {
      if (err instanceof DraftError) {
        res.status(err.status).json({ error: err.message });
        return;
      }
      throw err;
    }
    const { customer, appliedDiscount, orderItems, fields } = draft;
    const customerId = customer.id;

    const order = await prisma.order.create({
      data: {
        customerId,
        customerPhone: customer.phone,
        ...fields,
        source: "admin",
        // Manual/in-person orders are entered after the fact (the admin is recording a
        // sale that already happened), so they should land as delivered by default
        // rather than starting the pending → confirmed → … pipeline meant for
        // website orders.
        status: "delivered",
        items: { create: orderItems },
      },
      include: { items: true, customer: true },
    });

    if (fields.walletAmountUsed > 0) {
      await redeemWallet(customerId, fields.walletAmountUsed, order.id);
    }

    if (appliedDiscount?.isPersonal) {
      await prisma.discountCode.update({
        where: { id: appliedDiscount.id },
        data: { usedAt: new Date(), isActive: false },
      });
    }

    if (fields.orderType !== "preorder") {
      await decrementStockForItems(order.items);
    }
    await creditWalletCashback(order.id);
    await notifyLoyaltyUpgrade(order.customerId);

    res.status(201).json(order);
  }),
);

adminOrdersRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: { items: true, customer: true, address: { select: { lat: true, lng: true } } },
    });
    if (!order) {
      res.status(404).json({ error: "سفارش یافت نشد" });
      return;
    }
    res.json({ ...order, walletCashbackRemaining: await getOutstandingOrderCashback(order.id) });
  }),
);

/**
 * Edits a manually-created (admin) order. The order's old side effects —
 * stock taken, wallet money held, cashback granted, personal discount code
 * consumed — are rolled back, the order is rewritten from the new payload,
 * and the same side effects are applied again for the new values. The
 * customer, order number, status and creation date are kept. The new payload
 * is fully validated before anything is touched.
 */
adminOrdersRouter.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const parsed = createOrderSchema.safeParse(req.body);
    if (!parsed.success) {
      res
        .status(400)
        .json({ error: parsed.error.issues[0]?.message ?? "اطلاعات سفارش نامعتبر است" });
      return;
    }
    const existing = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: { items: true },
    });
    if (!existing) {
      res.status(404).json({ error: "سفارش یافت نشد" });
      return;
    }
    if (existing.source !== "admin") {
      res.status(400).json({ error: "فقط سفارش‌های دستی قابل ویرایش هستند" });
      return;
    }
    if (existing.status === "cancelled") {
      res.status(400).json({ error: "سفارش لغو شده قابل ویرایش نیست" });
      return;
    }
    if (existing.customerId !== parsed.data.customerId) {
      res.status(400).json({ error: "مشتری سفارش قابل تغییر نیست" });
      return;
    }

    let draft: OrderDraft;
    try {
      draft = await buildOrderDraft(parsed.data, existing);
    } catch (err) {
      if (err instanceof DraftError) {
        res.status(err.status).json({ error: err.message });
        return;
      }
      throw err;
    }
    const { customer, appliedDiscount, orderItems, fields } = draft;
    const customerId = customer.id;

    // Roll back what the old version of the order did.
    await reverseWalletCashback(existing.id, "بازگشت پاداش خرید به دلیل ویرایش سفارش");
    const keptByCustomer = await getRetainedOrderCashback(existing.id);
    await refundWalletHold(existing.id, "بازگشت وجه کیف پول به دلیل ویرایش سفارش");
    await restockItems(existing.items);
    if (existing.discountCode && existing.discountCode !== appliedDiscount?.code) {
      await prisma.discountCode.updateMany({
        where: { code: existing.discountCode, customerId: { not: null } },
        data: { usedAt: null, isActive: true },
      });
    }

    const order = await prisma.order.update({
      where: { id: existing.id },
      data: {
        ...fields,
        // Optional fields must be cleared explicitly when the edit drops them.
        addressId: fields.addressId ?? null,
        addressText: fields.addressText ?? null,
        distanceKm: fields.distanceKm ?? null,
        discountCode: fields.discountCode ?? null,
        note: fields.note ?? null,
        items: { deleteMany: {}, create: orderItems },
      },
      include: { items: true, customer: true, address: { select: { lat: true, lng: true } } },
    });

    // Re-apply the side effects for the new values.
    if (fields.walletAmountUsed > 0) {
      await redeemWallet(customerId, fields.walletAmountUsed, order.id);
    }
    if (appliedDiscount?.isPersonal) {
      await prisma.discountCode.update({
        where: { id: appliedDiscount.id },
        data: { usedAt: new Date(), isActive: false },
      });
    }
    if (fields.orderType !== "preorder") {
      await decrementStockForItems(order.items);
    }
    if (order.status === "delivered") {
      await creditWalletCashback(order.id, keptByCustomer);
    }
    await notifyLoyaltyUpgrade(order.customerId);

    res.json(order);
  }),
);

const paymentStatusSchema = z.object({
  paymentStatus: z.enum(["pending", "paid", "failed"]),
});

/** Lets the admin mark a manually-created (pay-on-delivery/cash) order as paid once collected. */
adminOrdersRouter.patch(
  "/:id/payment-status",
  asyncHandler(async (req, res) => {
    const parsed = paymentStatusSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "وضعیت پرداخت نامعتبر است" });
      return;
    }
    const order = await prisma.order.update({
      where: { id: req.params.id },
      data: { paymentStatus: parsed.data.paymentStatus },
      include: { items: true, customer: true },
    });
    // Cashback only credits once an order is both delivered and paid; if delivery happened
    // first (e.g. a manually-created cash-on-delivery order), marking it paid afterward is
    // what should trigger the credit. creditWalletCashback is idempotent, so this is safe.
    if (order.paymentStatus === "paid" && order.status === "delivered") {
      await creditWalletCashback(order.id);
    }
    await notifyLoyaltyUpgrade(order.customerId);
    res.json(order);
  }),
);

const patchSchema = z.object({
  status: z.enum(ORDER_STATUSES),
});

const bulkDeleteSchema = z.object({ ids: z.array(z.string().min(1)).min(1) });

adminOrdersRouter.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const parsed = patchSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "وضعیت سفارش نامعتبر است" });
      return;
    }
    const existing = await prisma.order.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      res.status(404).json({ error: "سفارش یافت نشد" });
      return;
    }
    const order = await prisma.order.update({
      where: { id: req.params.id },
      data: { status: parsed.data.status },
      include: { items: true, customer: true },
    });
    // Coming back from "cancelled" into any active status takes stock again
    // — it was returned when the order was cancelled, so leaving that status
    // must re-take it, exactly like a fresh order would (preorders excepted:
    // they never decrement stock at all, cancelled or not).
    if (existing.status === "cancelled" && parsed.data.status !== "cancelled" && order.orderType !== "preorder") {
      await decrementStockForItems(order.items);
    }
    if (parsed.data.status === "delivered") {
      await creditWalletCashback(order.id);
    } else if (parsed.data.status === "cancelled") {
      await reverseWalletCashback(order.id);
      await refundWalletHold(order.id, "بازگشت وجه کیف پول به دلیل لغو سفارش");
      // Only return stock the first time the order lands in "cancelled" —
      // otherwise re-saving an already-cancelled order would restock twice.
      // restockItems itself only returns each item's recorded
      // stockDecremented amount, so items that never took stock (out of
      // stock at order time, or a preorder) are correctly left alone.
      if (existing.status !== "cancelled") {
        await restockItems(order.items);
      }
    }
    await notifyLoyaltyUpgrade(order.customerId);
    res.json(order);
  }),
);

adminOrdersRouter.delete(
  "/bulk",
  asyncHandler(async (req, res) => {
    const parsed = bulkDeleteSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "شناسه‌های نامعتبر" });
      return;
    }
    const ordersToDelete = await prisma.order.findMany({
      where: { id: { in: parsed.data.ids } },
      include: { items: true },
    });
    // Any cashback already paid out, and any wallet amount already spent on
    // the order, must be reversed/refunded before the order itself disappears.
    for (const id of parsed.data.ids) {
      await reverseWalletCashback(id);
      await refundWalletHold(id, "بازگشت وجه کیف پول به دلیل حذف سفارش");
    }
    // Same rule as cancelling: skip orders already cancelled (already
    // returned) — restockItems itself only returns each item's recorded
    // stockDecremented amount, so anything that never took stock is a no-op.
    for (const order of ordersToDelete) {
      if (order.status !== "cancelled") {
        await restockItems(order.items);
      }
    }
    await prisma.order.deleteMany({ where: { id: { in: parsed.data.ids } } });
    res.status(204).end();
  }),
);
