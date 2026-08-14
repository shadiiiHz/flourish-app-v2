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
