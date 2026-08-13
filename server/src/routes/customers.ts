import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { requireCustomerAuth } from "../middleware/requireCustomerAuth.js";

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
      });
    } catch {
      res.status(409).json({ error: "این شماره موبایل قبلاً ثبت شده است" });
    }
  }),
);

customersRouter.get(
  "/me/orders",
  asyncHandler(async (req, res) => {
    const orders = await prisma.order.findMany({
      where: { customerId: req.customer!.sub },
      include: { items: true },
      orderBy: { createdAt: "desc" },
    });
    res.json(orders);
  }),
);

const addressSchema = z.object({
  title: z.string().optional(),
  address: z.string().min(1),
  details: z.string().optional(),
  phone: z.string().optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
});

customersRouter.get(
  "/me/addresses",
  asyncHandler(async (req, res) => {
    const addresses = await prisma.address.findMany({
      where: { customerId: req.customer!.sub },
      orderBy: { createdAt: "asc" },
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
    const address = await prisma.address.create({
      data: { ...parsed.data, customerId: req.customer!.sub },
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
    const { count } = await prisma.address.updateMany({
      where: { id: req.params.id, customerId: req.customer!.sub },
      data: parsed.data,
    });
    if (count === 0) {
      res.status(404).json({ error: "آدرس یافت نشد" });
      return;
    }
    const address = await prisma.address.findUnique({ where: { id: req.params.id } });
    res.json(address);
  }),
);

customersRouter.delete(
  "/me/addresses/:id",
  asyncHandler(async (req, res) => {
    const { count } = await prisma.address.deleteMany({
      where: { id: req.params.id, customerId: req.customer!.sub },
    });
    if (count === 0) {
      res.status(404).json({ error: "آدرس یافت نشد" });
      return;
    }
    res.status(204).end();
  }),
);
