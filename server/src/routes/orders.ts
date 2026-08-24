import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { requireCustomerAuth } from "../middleware/requireCustomerAuth.js";
import { calculateShipping, getSettings } from "../lib/shipping.js";
import { isSiteOpen } from "../lib/businessHours.js";
import { requestZarinpalPayment, verifyZarinpalPayment } from "../lib/zarinpal.js";
import { TAX_RATE, getDiscountedPrice } from "../lib/pricing.js";
import { env } from "../lib/env.js";
import { redeemWallet, refundWalletHold } from "../lib/wallet.js";
import { sendPatternSms } from "../lib/sms.js";
import { formatOrderNumber } from "../lib/orderNumber.js";

/**
 * Notifies the admin phone over SMS once an order is actually paid — either
 * immediately (fully covered by wallet balance) or after the customer
 * completes payment at Zarinpal and is redirected back — never at order
 * creation, so an abandoned/failed gateway payment doesn't page the admin.
 * Best-effort only — a MeliPayamak failure (no credit, rejected number, etc.)
 * must never fail the request, so errors are just logged.
 */
async function notifyAdminOfNewOrder(orderNumber: number): Promise<void> {
  if (!env.melipayamakApiKey || !env.melipayamakAdminOrderBodyId || !env.adminNotifyPhone) return;
  try {
    await sendPatternSms(env.adminNotifyPhone, env.melipayamakAdminOrderBodyId, [
      formatOrderNumber(orderNumber),
    ]);
  } catch (err) {
    console.error("Failed to notify admin of new order:", err);
  }
}

export const ordersRouter = Router();

const MAX_PREORDER_DAYS_AHEAD = 10;
const MIN_PREORDER_DAYS_AHEAD = 2;

const createOrderSchema = z
  .object({
    addressId: z.string().min(1).optional(),
    deliveryMethod: z.enum(["delivery", "pickup"]).optional().default("delivery"),
    customerName: z.string().optional(),
    note: z.string().optional(),
    orderType: z.enum(["instant", "preorder"]).optional().default("instant"),
    scheduledDate: z.string().optional(),
    scheduledTimeSlot: z.string().optional(),
    discountCode: z.string().trim().min(1).optional(),
    useWallet: z.boolean().optional().default(false),
  })
  .refine(
    (data) => data.orderType !== "preorder" || (data.scheduledDate && data.scheduledTimeSlot),
    { message: "تاریخ و ساعت پیش‌سفارش الزامی است" },
  )
  .refine((data) => data.deliveryMethod !== "delivery" || !!data.addressId, {
    message: "لطفاً یک آدرس برای ارسال انتخاب کنید",
  });

ordersRouter.post(
  "/",
  requireCustomerAuth,
  asyncHandler(async (req, res) => {
    const parsed = createOrderSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "اطلاعات سفارش نامعتبر است" });
      return;
    }
    const { addressId, deliveryMethod, customerName, note, orderType, scheduledTimeSlot, discountCode, useWallet } =
      parsed.data;
    const { sub: customerId, phone: customerPhone } = req.customer!;

    let appliedDiscount: { code: string; percent: number } | null = null;
    if (discountCode) {
      const discount = await prisma.discountCode.findUnique({
        where: { code: discountCode.toUpperCase() },
      });
      if (!discount || !discount.isActive) {
        res.status(400).json({ error: "کد تخفیف معتبر نیست" });
        return;
      }
      appliedDiscount = { code: discount.code, percent: discount.percent };
    }

    const settings = await getSettings();
    if (!isSiteOpen(settings) && orderType !== "preorder") {
      res
        .status(400)
        .json({ error: "امروز فلوریش تعطیل است و فقط ثبت پیش‌سفارش امکان‌پذیر است" });
      return;
    }

    let scheduledDate: Date | undefined;
    if (orderType === "preorder") {
      scheduledDate = new Date(parsed.data.scheduledDate!);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const minDate = new Date(today);
      minDate.setDate(minDate.getDate() + MIN_PREORDER_DAYS_AHEAD);
      const maxDate = new Date(today);
      maxDate.setDate(maxDate.getDate() + MIN_PREORDER_DAYS_AHEAD + MAX_PREORDER_DAYS_AHEAD - 1);
      if (Number.isNaN(scheduledDate.getTime()) || scheduledDate < minDate || scheduledDate > maxDate) {
        res.status(400).json({ error: "تاریخ پیش‌سفارش نامعتبر است" });
        return;
      }
    }

    const address =
      deliveryMethod === "delivery"
        ? await prisma.address.findFirst({ where: { id: addressId, customerId } })
        : null;
    if (deliveryMethod === "delivery") {
      if (!address) {
        res.status(404).json({ error: "آدرس یافت نشد" });
        return;
      }
      if (address.lat == null || address.lng == null) {
        res.status(400).json({ error: "موقعیت مکانی این آدرس ثبت نشده است" });
        return;
      }
    }

    const cartItems = await prisma.cartItem.findMany({
      where: { customerId },
      include: { product: true, variant: true },
    });
    if (cartItems.length === 0) {
      res.status(400).json({ error: "سبد خرید خالی است" });
      return;
    }
    if (orderType === "preorder") {
      // Preorder availability depends only on allowPreorder — general isAvailable/stock don't apply.
      const notPreorderable = cartItems.find((item) => !item.product.allowPreorder);
      if (notPreorderable) {
        res
          .status(400)
          .json({ error: `«${notPreorderable.product.title}» قابل پیش‌سفارش نیست` });
        return;
      }
    } else {
      const unavailableItem = cartItems.find((item) => !item.product.isAvailable);
      if (unavailableItem) {
        res.status(400).json({ error: `«${unavailableItem.product.title}» دیگر موجود نیست` });
        return;
      }
    }

    const orderItems = cartItems.map((item) => {
      const basePrice = item.variant ? item.variant.price : item.product.price;
      return {
        productId: item.productId,
        variantId: item.variantId,
        title: item.product.title,
        variantTitle: item.variant?.title,
        price: getDiscountedPrice(basePrice, item.product.discountPercent),
        quantity: item.quantity,
      };
    });

    const subtotal = orderItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const discountAmount = appliedDiscount
      ? Math.round((subtotal * appliedDiscount.percent) / 100)
      : 0;
    const tax = Math.round((subtotal - discountAmount) * TAX_RATE);
    const shippingResult =
      deliveryMethod === "delivery" && address
        ? await calculateShipping(address.lat!, address.lng!)
        : { distanceKm: undefined, shippingCost: 0, outOfRange: false };
    if (deliveryMethod === "delivery" && shippingResult.outOfRange) {
      res
        .status(400)
        .json({ error: "این آدرس خارج از محدوده سرویس‌دهی فلوریش است" });
      return;
    }
    const { distanceKm, shippingCost } = shippingResult;
    const total = subtotal - discountAmount + tax + shippingCost;

    let walletAmountUsed = 0;
    if (useWallet) {
      const customer = await prisma.customer.findUnique({ where: { id: customerId } });
      if (customer && customer.walletBalance > 0) {
        walletAmountUsed = Math.min(customer.walletBalance, total);
      }
    }

    const order = await prisma.order.create({
      data: {
        customerId,
        customerPhone,
        customerName,
        note,
        orderType,
        deliveryMethod,
        scheduledDate,
        scheduledTimeSlot: orderType === "preorder" ? scheduledTimeSlot : undefined,
        addressId: address?.id,
        addressText:
          deliveryMethod === "delivery" && address
            ? [address.address, address.details].filter(Boolean).join(" — ")
            : "مراجعه حضوری به فلوریش",
        distanceKm,
        subtotal,
        discountCode: appliedDiscount?.code,
        discountAmount,
        tax,
        shippingCost,
        total,
        walletAmountUsed,
        items: { create: orderItems },
      },
      include: { items: true },
    });

    if (walletAmountUsed > 0) {
      await redeemWallet(customerId, walletAmountUsed, order.id);
    }

    const payableAmount = total - walletAmountUsed;

    if (payableAmount <= 0) {
      const paidOrder = await prisma.order.update({
        where: { id: order.id },
        data: { paymentStatus: "paid" },
        include: { items: true },
      });
      await prisma.cartItem.deleteMany({ where: { customerId } });
      await notifyAdminOfNewOrder(order.orderNumber);
      res.status(201).json({ order: paidOrder, paymentUrl: null });
      return;
    }

    try {
      const { authority, payUrl } = await requestZarinpalPayment({
        amountToman: payableAmount,
        description: `پرداخت سفارش فلوریش #${order.id}`,
        callbackUrl: `${env.apiUrl}/api/orders/${order.id}/payment/callback`,
        mobile: customerPhone,
      });
      await prisma.order.update({
        where: { id: order.id },
        data: { paymentAuthority: authority },
      });
      res.status(201).json({ order, paymentUrl: payUrl });
    } catch (err) {
      console.error("Zarinpal payment request failed:", err);
      await refundWalletHold(order.id);
      const message = err instanceof Error ? err.message : "خطا در اتصال به درگاه پرداخت";
      res.status(502).json({ error: message, orderId: order.id });
    }
  }),
);

ordersRouter.get(
  "/:id/payment/callback",
  asyncHandler(async (req, res) => {
    const order = await prisma.order.findUnique({ where: { id: req.params.id } });
    const authority = typeof req.query.Authority === "string" ? req.query.Authority : undefined;
    const status = typeof req.query.Status === "string" ? req.query.Status : undefined;

    if (!order || !order.paymentAuthority || order.paymentAuthority !== authority) {
      res.redirect(`${env.appUrl}/checkout/result?status=failed`);
      return;
    }

    if (status !== "OK") {
      await prisma.order.update({
        where: { id: order.id },
        data: { paymentStatus: "failed" },
      });
      await refundWalletHold(order.id);
      res.redirect(`${env.appUrl}/checkout/result?status=failed&orderId=${order.id}`);
      return;
    }

    const verified = await verifyZarinpalPayment({
      amountToman: order.total - order.walletAmountUsed,
      authority: order.paymentAuthority,
    });

    if (!verified.ok) {
      await prisma.order.update({
        where: { id: order.id },
        data: { paymentStatus: "failed" },
      });
      await refundWalletHold(order.id);
      res.redirect(`${env.appUrl}/checkout/result?status=failed&orderId=${order.id}`);
      return;
    }

    await prisma.order.update({
      where: { id: order.id },
      data: { paymentStatus: "paid", paymentRefId: verified.refId },
    });
    if (order.customerId) {
      await prisma.cartItem.deleteMany({ where: { customerId: order.customerId } });
    }
    await notifyAdminOfNewOrder(order.orderNumber);
    res.redirect(`${env.appUrl}/checkout/result?status=paid&orderId=${order.id}`);
  }),
);
