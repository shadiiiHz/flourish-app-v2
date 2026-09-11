import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { asyncHandler } from "../../lib/asyncHandler.js";
import { parsePagination, parseSearch, paginatedResult } from "../../lib/pagination.js";
import { ensureBirthdayMessage } from "../../lib/birthdayDiscount.js";

export const adminCustomersRouter = Router();

const PHONE_REGEX = /^09\d{9}$/;

const bulkDeleteSchema = z.object({ ids: z.array(z.string().min(1)).min(1) });

const createCustomerSchema = z.object({
  phone: z.string().regex(PHONE_REGEX, "شماره موبایل معتبر نیست"),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  /** ISO datetime string. Only the month/day are used, for the birthday discount. */
  birthDate: z.string().datetime().nullable().optional(),
});

const updateCustomerSchema = z.object({
  phone: z.string().regex(PHONE_REGEX, "شماره موبایل معتبر نیست"),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  /** ISO datetime string, or null to clear it. Only the month/day are used, for the birthday discount. */
  birthDate: z.string().datetime().nullable().optional(),
});

adminCustomersRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const search = parseSearch(req);
    const where = search
      ? {
          OR: [
            { firstName: { contains: search, mode: "insensitive" as const } },
            { lastName: { contains: search, mode: "insensitive" as const } },
            { phone: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : undefined;

    const pagination = parsePagination(req);
    const [customers, total] = await prisma.$transaction([
      prisma.customer.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        include: { _count: { select: { orders: true } } },
        skip: pagination.skip,
        take: pagination.take,
      }),
      prisma.customer.count({ where }),
    ]);
    res.json(paginatedResult(customers, total, pagination));
  }),
);

adminCustomersRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const customer = await prisma.customer.findUnique({
      where: { id: req.params.id },
      include: {
        orders: { include: { items: true }, orderBy: { createdAt: "desc" } },
        addresses: { orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }] },
      },
    });
    if (!customer) {
      res.status(404).json({ error: "مشتری یافت نشد" });
      return;
    }
    res.json(customer);
  }),
);

adminCustomersRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const parsed = createCustomerSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? "اطلاعات نامعتبر است" });
      return;
    }
    const { phone, firstName, lastName, email, birthDate } = parsed.data;
    const existing = await prisma.customer.findUnique({ where: { phone } });
    if (existing) {
      res.status(409).json({ error: "مشتری با این شماره موبایل قبلاً ثبت شده است" });
      return;
    }
    const customer = await prisma.customer.create({
      data: {
        phone,
        firstName,
        lastName,
        email: email || undefined,
        birthDate: birthDate ? new Date(birthDate) : undefined,
        source: "admin",
      },
    });
    if (customer.birthDate) {
      await ensureBirthdayMessage(customer.id, customer.birthDate);
    }
    res.status(201).json(customer);
  }),
);

adminCustomersRouter.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const parsed = updateCustomerSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? "اطلاعات نامعتبر است" });
      return;
    }
    const customer = await prisma.customer.findUnique({ where: { id: req.params.id } });
    if (!customer) {
      res.status(404).json({ error: "مشتری یافت نشد" });
      return;
    }
    const { phone, firstName, lastName, email, birthDate } = parsed.data;
    if (phone !== customer.phone) {
      const existing = await prisma.customer.findUnique({ where: { phone } });
      if (existing) {
        res.status(409).json({ error: "مشتری با این شماره موبایل قبلاً ثبت شده است" });
        return;
      }
    }
    const updated = await prisma.customer.update({
      where: { id: req.params.id },
      data: {
        phone,
        firstName,
        lastName,
        email: email || null,
        ...(birthDate !== undefined ? { birthDate: birthDate ? new Date(birthDate) : null } : {}),
      },
    });
    if (birthDate !== undefined && customer.birthDate?.toISOString() !== updated.birthDate?.toISOString()) {
      // The birthday changed, so any earlier notice — even one already actioned
      // into a discount code — was for the wrong date. Clear it so
      // ensureBirthdayMessage isn't blocked by its "already notified recently"
      // dedup check and can create a fresh notice for the corrected date.
      await prisma.adminMessage.deleteMany({
        where: { customerId: updated.id, type: "birthday" },
      });
      // A birthday discount code generated off the old date is only valid if
      // it's already been redeemed (that's real order history now) — an
      // unused one no longer corresponds to an actual birthday and shouldn't
      // still be usable.
      await prisma.discountCode.deleteMany({
        where: { customerId: updated.id, source: "birthday", usedAt: null },
      });
      if (updated.birthDate) {
        await ensureBirthdayMessage(updated.id, updated.birthDate);
      }
    }
    res.json(updated);
  }),
);

adminCustomersRouter.delete(
  "/bulk",
  asyncHandler(async (req, res) => {
    const parsed = bulkDeleteSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "شناسه‌های نامعتبر" });
      return;
    }
    await prisma.customer.deleteMany({ where: { id: { in: parsed.data.ids } } });
    res.status(204).end();
  }),
);

adminCustomersRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const customer = await prisma.customer.findUnique({ where: { id: req.params.id } });
    if (!customer) {
      res.status(404).json({ error: "مشتری یافت نشد" });
      return;
    }
    await prisma.customer.delete({ where: { id: req.params.id } });
    res.status(204).end();
  }),
);
