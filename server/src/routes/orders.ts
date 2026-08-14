import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { requireCustomerAuth } from "../middleware/requireCustomerAuth.js";
import { calculateShipping } from "../lib/shipping.js";
import { requestZarinpalPayment, verifyZarinpalPayment } from "../lib/zarinpal.js";
import { env } from "../lib/env.js";

export const ordersRouter = Router();

const TAX_RATE = 0.1;

const orderItemSchema = z.object({
  productId: z.string().optional(),
  variantId: z.string().optional(),
  title: z.string(),
  variantTitle: z.string().optional(),
  price: z.number().int().nonnegative(),
  quantity: z.number().int().positive(),
});

const createOrderSchema = z.object({
  addressId: z.string().min(1),
  customerName: z.string().optional(),
  note: z.string().optional(),
  items: z.array(orderItemSchema).min(1),
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
    const { addressId, customerName, note, items } = parsed.data;
    const { sub: customerId, phone: customerPhone } = req.customer!;

    const address = await prisma.address.findFirst({
      where: { id: addressId, customerId },
    });
    if (!address) {
      res.status(404).json({ error: "آدرس یافت نشد" });
      return;
    }
    if (address.lat == null || address.lng == null) {
      res.status(400).json({ error: "موقعیت مکانی این آدرس ثبت نشده است" });
      return;
    }

    const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const tax = Math.round(subtotal * TAX_RATE);
    const { distanceKm, shippingCost } = await calculateShipping(address.lat, address.lng);
    const total = subtotal + tax + shippingCost;

    const order = await prisma.order.create({
      data: {
        customerId,
        customerPhone,
        customerName,
        note,
        addressId: address.id,
        addressText: [address.address, address.details].filter(Boolean).join(" — "),
        distanceKm,
        subtotal,
        tax,
        shippingCost,
        total,
        items: {
          create: items.map((item) => ({
            productId: item.productId,
            variantId: item.variantId,
            title: item.title,
            variantTitle: item.variantTitle,
            price: item.price,
            quantity: item.quantity,
          })),
        },
      },
      include: { items: true },
    });

    try {
      const { authority, payUrl } = await requestZarinpalPayment({
        amountToman: order.total,
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
      res.redirect(`${env.appUrl}/checkout/result?status=failed&orderId=${order.id}`);
      return;
    }

    const verified = await verifyZarinpalPayment({
      amountToman: order.total,
      authority: order.paymentAuthority,
    });

    if (!verified.ok) {
      await prisma.order.update({
        where: { id: order.id },
        data: { paymentStatus: "failed" },
      });
      res.redirect(`${env.appUrl}/checkout/result?status=failed&orderId=${order.id}`);
      return;
    }

    await prisma.order.update({
      where: { id: order.id },
      data: { paymentStatus: "paid", paymentRefId: verified.refId },
    });
    res.redirect(`${env.appUrl}/checkout/result?status=paid&orderId=${order.id}`);
  }),
);
