import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { asyncHandler } from "../../lib/asyncHandler.js";
import { parsePagination, parseSearch, paginatedResult } from "../../lib/pagination.js";
import { generateDiscountCode } from "../../lib/discountCodes.js";
import { deactivateExpiredDiscountCodes } from "../../lib/birthdayDiscount.js";
import { tehranEndOfDay } from "../../lib/tehranDate.js";
import { notifyCustomerOfDiscountCode } from "../../lib/customerDiscountSms.js";

export const adminDiscountCodesRouter = Router();

const bulkDeleteSchema = z.object({ ids: z.array(z.string().min(1)).min(1) });

const createSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("manual"),
    code: z.string().trim().min(3).max(32),
    percent: z.number().int().min(1).max(100),
  }),
  z.object({
    mode: z.literal("auto"),
    percent: z.number().int().min(1).max(100),
  }),
  /** A personal, single-use code for one customer that expires after `validDays` and is texted to them. */
  z.object({
    mode: z.literal("customer"),
    customerId: z.string().min(1),
    /** The code's text — generated automatically when omitted. */
    code: z.string().trim().min(3).max(32).optional(),
    percent: z.number().int().min(1).max(100),
    validDays: z.number().int().min(1).max(365),
  }),
]);

const updateSchema = z.object({
  percent: z.number().int().min(1).max(100).optional(),
  isActive: z.boolean().optional(),
});

async function generateUniqueCode() {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = generateDiscountCode();
    const exists = await prisma.discountCode.findUnique({ where: { code } });
    if (!exists) return code;
  }
  throw new Error("امکان تولید کد تخفیف یکتا وجود نداشت");
}

adminDiscountCodesRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    // Don't rely on the midnight sweep alone for what the admin sees.
    await deactivateExpiredDiscountCodes();
    const search = parseSearch(req);
    const customerId = typeof req.query.customerId === "string" ? req.query.customerId : undefined;
    // "usable" = still redeemable right now: active, not yet used, not expired.
    const usableOnly = req.query.usable === "true";
    const conditions: object[] = [];
    if (search) conditions.push({ code: { contains: search, mode: "insensitive" as const } });
    // With includeGeneric, a customer's view also lists the codes anyone can use (no customer attached).
    const includeGeneric = req.query.includeGeneric === "true";
    if (customerId) {
      conditions.push(includeGeneric ? { OR: [{ customerId }, { customerId: null }] } : { customerId });
    }
    if (usableOnly) {
      conditions.push({
        isActive: true,
        usedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      });
    }
    const where = conditions.length > 0 ? { AND: conditions } : undefined;

    const pagination = parsePagination(req);
    const [items, total] = await prisma.$transaction([
      prisma.discountCode.findMany({
        where,
        include: {
          customer: { select: { id: true, phone: true, firstName: true, lastName: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: pagination.skip,
        take: pagination.take,
      }),
      prisma.discountCode.count({ where }),
    ]);
    res.json(paginatedResult(items, total, pagination));
  }),
);

adminDiscountCodesRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "اطلاعات کد تخفیف نامعتبر است" });
      return;
    }

    if (parsed.data.mode === "manual") {
      const code = parsed.data.code.toUpperCase();
      const exists = await prisma.discountCode.findUnique({ where: { code } });
      if (exists) {
        res.status(409).json({ error: "این کد تخفیف قبلاً ثبت شده است" });
        return;
      }
      const created = await prisma.discountCode.create({
        data: { code, percent: parsed.data.percent },
      });
      res.status(201).json(created);
      return;
    }

    if (parsed.data.mode === "customer") {
      const customer = await prisma.customer.findUnique({ where: { id: parsed.data.customerId } });
      if (!customer) {
        res.status(404).json({ error: "مشتری یافت نشد" });
        return;
      }
      let code: string;
      if (parsed.data.code) {
        code = parsed.data.code.toUpperCase();
        if (await prisma.discountCode.findUnique({ where: { code } })) {
          res.status(409).json({ error: "این کد تخفیف قبلاً ثبت شده است" });
          return;
        }
      } else {
        code = await generateUniqueCode();
      }
      // Valid through the end of the last day (Tehran), so "N days" matches the date texted to the customer.
      const expiresAt = tehranEndOfDay(new Date(Date.now() + parsed.data.validDays * 86400000));
      const created = await prisma.discountCode.create({
        data: {
          code,
          percent: parsed.data.percent,
          customerId: customer.id,
          expiresAt,
        },
        include: {
          customer: { select: { id: true, phone: true, firstName: true, lastName: true } },
        },
      });
      const smsSent = await notifyCustomerOfDiscountCode(customer, created.code, expiresAt);
      res.status(201).json({ ...created, smsSent });
      return;
    }

    const code = await generateUniqueCode();
    const created = await prisma.discountCode.create({
      data: { code, percent: parsed.data.percent },
    });
    res.status(201).json(created);
  }),
);

adminDiscountCodesRouter.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "اطلاعات کد تخفیف نامعتبر است" });
      return;
    }
    const updated = await prisma.discountCode.update({
      where: { id: req.params.id },
      data: parsed.data,
    });
    res.json(updated);
  }),
);

adminDiscountCodesRouter.delete(
  "/bulk",
  asyncHandler(async (req, res) => {
    const parsed = bulkDeleteSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "شناسه‌های نامعتبر" });
      return;
    }
    await prisma.discountCode.deleteMany({ where: { id: { in: parsed.data.ids } } });
    res.status(204).end();
  }),
);

adminDiscountCodesRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    await prisma.discountCode.delete({ where: { id: req.params.id } });
    res.status(204).end();
  }),
);
