import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { asyncHandler } from "../lib/asyncHandler.js";

export const customersRouter = Router();

const syncSchema = z.object({
  phone: z.string().min(5),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  email: z.string().optional(),
  avatar: z.string().optional(),
});

customersRouter.post(
  "/sync",
  asyncHandler(async (req, res) => {
    const parsed = syncSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "شماره موبایل معتبر نیست" });
      return;
    }
    const { phone, ...rest } = parsed.data;

    const customer = await prisma.customer.upsert({
      where: { phone },
      update: rest,
      create: { phone, ...rest },
    });
    res.json(customer);
  }),
);

customersRouter.get(
  "/:phone/orders",
  asyncHandler(async (req, res) => {
    const orders = await prisma.order.findMany({
      where: { customerPhone: req.params.phone },
      include: { items: true },
      orderBy: { createdAt: "desc" },
    });
    res.json(orders);
  }),
);
