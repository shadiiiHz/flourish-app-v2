import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { requireCustomerAuth } from "../middleware/requireCustomerAuth.js";

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
    const { customerName, note, items } = parsed.data;
    const { sub: customerId, phone: customerPhone } = req.customer!;

    const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const tax = Math.round(subtotal * TAX_RATE);
    const total = subtotal + tax;

    const order = await prisma.order.create({
      data: {
        customerId,
        customerPhone,
        customerName,
        note,
        subtotal,
        tax,
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

    res.status(201).json(order);
  }),
);
