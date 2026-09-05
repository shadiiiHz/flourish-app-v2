import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { asyncHandler } from "../../lib/asyncHandler.js";
import { parsePagination, parseSearch, paginatedResult } from "../../lib/pagination.js";
import { creditWalletCashback, redeemWallet, reverseWalletCashback } from "../../lib/wallet.js";
import { calculateShipping } from "../../lib/shipping.js";
import { TAX_RATE, getDiscountedPrice } from "../../lib/pricing.js";
import { decrementStockForItems } from "../../lib/stock.js";

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

    const conditions = [];
    if (status && (ORDER_STATUSES as readonly string[]).includes(status)) {
      conditions.push({ status: status as (typeof ORDER_STATUSES)[number] });
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
        include: { items: true, customer: true },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: pagination.skip,
        take: pagination.take,
      }),
      prisma.order.count({ where }),
    ]);
    res.json(paginatedResult(orders, total, pagination));
  }),
);

const orderItemInputSchema = z.object({
  productId: z.string().min(1),
  variantId: z.string().optional(),
  quantity: z.number().int().positive(),
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
    paymentStatus: z.enum(["pending", "paid"]).default("pending"),
    customerName: z.string().optional(),
    note: z.string().optional(),
  })
  .refine((data) => (data.items && data.items.length > 0) || data.manualSubtotal != null, {
    message: "حداقل یک آیتم اضافه کنید یا جمع کل اقلام را وارد کنید",
  })
  .refine((data) => data.deliveryMethod !== "delivery" || !!data.addressId || !!data.addressText, {
    message: "برای ارسال باید یک آدرس (ثبت‌شده یا دستی) مشخص شود",
  });

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
    } = parsed.data;

    const customer = await prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer) {
      res.status(404).json({ error: "مشتری یافت نشد" });
      return;
    }

    let appliedDiscount: { id: string; code: string; percent: number; isPersonal: boolean } | null = null;
    if (discountCode) {
      const discount = await prisma.discountCode.findUnique({
        where: { code: discountCode.toUpperCase() },
      });
      if (!discount || !discount.isActive) {
        res.status(400).json({ error: "کد تخفیف معتبر نیست" });
        return;
      }
      if (discount.customerId && discount.customerId !== customerId) {
        res.status(400).json({ error: "این کد تخفیف مخصوص این مشتری نیست" });
        return;
      }
      if (discount.usedAt) {
        res.status(400).json({ error: "این کد تخفیف قبلاً استفاده شده است" });
        return;
      }
      if (discount.expiresAt && discount.expiresAt.getTime() < Date.now()) {
        res.status(400).json({ error: "این کد تخفیف منقضی شده است" });
        return;
      }
      appliedDiscount = {
        id: discount.id,
        code: discount.code,
        percent: discount.percent,
        isPersonal: !!discount.customerId,
      };
    }

    const orderItems: {
      productId?: string;
      variantId?: string;
      title: string;
      variantTitle?: string;
      price: number;
      quantity: number;
    }[] = [];

    if (manualSubtotal != null) {
      // Admin chose to skip picking real products and just entered a total.
      orderItems.push({
        title: "اقلام سفارش (بدون جزئیات)",
        price: manualSubtotal,
        quantity: 1,
      });
    } else {
      const productIds = [...new Set(items!.map((i) => i.productId))];
      const products = await prisma.product.findMany({
        where: { id: { in: productIds } },
        include: { variants: true },
      });
      const productById = new Map(products.map((p) => [p.id, p]));

      if (deliveryMethod === "delivery") {
        const pickupOnlyTitles = [
          ...new Set(
            items!
              .map((item) => productById.get(item.productId))
              .filter((p) => p?.pickupOnly)
              .map((p) => p!.title),
          ),
        ];
        if (pickupOnlyTitles.length > 0) {
          const names = pickupOnlyTitles.map((t) => `«${t}»`).join("، ");
          const verb = pickupOnlyTitles.length > 1 ? "هستند" : "است";
          res.status(400).json({ error: `${names} فقط با تحویل حضوری قابل سفارش ${verb}` });
          return;
        }
      }

      for (const item of items!) {
        const product = productById.get(item.productId);
        if (!product) {
          res.status(400).json({ error: "یکی از محصولات انتخاب‌شده یافت نشد" });
          return;
        }
        const variant = item.variantId
          ? product.variants.find((v) => v.id === item.variantId)
          : undefined;
        if (item.variantId && !variant) {
          res.status(400).json({ error: `نوع انتخاب‌شده برای «${product.title}» یافت نشد` });
          return;
        }
        const basePrice = variant ? variant.price : product.price;
        orderItems.push({
          productId: product.id,
          variantId: variant?.id,
          title: product.title,
          variantTitle: variant?.title,
          price: getDiscountedPrice(basePrice, product.discountPercent),
          quantity: item.quantity,
        });
      }
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
        if (!address) {
          res.status(404).json({ error: "آدرس یافت نشد" });
          return;
        }
        if (address.lat != null && address.lng != null) {
          const shippingResult = await calculateShipping(address.lat, address.lng);
          if (shippingResult.outOfRange) {
            res.status(400).json({ error: "این آدرس خارج از محدوده سرویس‌دهی فلوریش است" });
            return;
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
      walletAmountUsed = Math.min(walletAmount, customer.walletBalance, total);
    }

    const order = await prisma.order.create({
      data: {
        customerId,
        customerPhone: customer.phone,
        customerName:
          customerName ||
          [customer.firstName, customer.lastName].filter(Boolean).join(" ") ||
          undefined,
        note,
        orderType: "instant",
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
        items: { create: orderItems },
      },
      include: { items: true, customer: true },
    });

    if (walletAmountUsed > 0) {
      await redeemWallet(customerId, walletAmountUsed, order.id);
    }

    if (appliedDiscount?.isPersonal) {
      await prisma.discountCode.update({
        where: { id: appliedDiscount.id },
        data: { usedAt: new Date(), isActive: false },
      });
    }

    await decrementStockForItems(order.items);

    res.status(201).json(order);
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
    const order = await prisma.order.update({
      where: { id: req.params.id },
      data: { status: parsed.data.status },
      include: { items: true, customer: true },
    });
    if (parsed.data.status === "delivered") {
      await creditWalletCashback(order.id);
    } else if (parsed.data.status === "cancelled") {
      await reverseWalletCashback(order.id);
    }
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
    // Any cashback already paid out for a delivered order must be clawed back
    // from the customer's wallet before the order itself disappears.
    for (const id of parsed.data.ids) {
      await reverseWalletCashback(id);
    }
    await prisma.order.deleteMany({ where: { id: { in: parsed.data.ids } } });
    res.status(204).end();
  }),
);
