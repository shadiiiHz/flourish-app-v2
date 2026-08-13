import { Router } from "express";
import { prisma } from "../../lib/prisma.js";
import { asyncHandler } from "../../lib/asyncHandler.js";

export const adminCustomersRouter = Router();

adminCustomersRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const customers = await prisma.customer.findMany({
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { orders: true } } },
    });
    res.json(customers);
  }),
);

adminCustomersRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const customer = await prisma.customer.findUnique({
      where: { id: req.params.id },
      include: { orders: { include: { items: true }, orderBy: { createdAt: "desc" } } },
    });
    if (!customer) {
      res.status(404).json({ error: "مشتری یافت نشد" });
      return;
    }
    res.json(customer);
  }),
);
