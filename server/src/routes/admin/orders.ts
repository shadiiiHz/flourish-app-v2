import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { asyncHandler } from "../../lib/asyncHandler.js";

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
    const orders = await prisma.order.findMany({
      where: status && (ORDER_STATUSES as readonly string[]).includes(status)
        ? { status: status as (typeof ORDER_STATUSES)[number] }
        : undefined,
      include: { items: true, customer: true },
      orderBy: { createdAt: "desc" },
    });
    res.json(orders);
  }),
);

const patchSchema = z.object({
  status: z.enum(ORDER_STATUSES),
});

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
    res.json(order);
  }),
);
