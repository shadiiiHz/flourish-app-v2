import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { asyncHandler } from "../../lib/asyncHandler.js";
import { parsePagination, parseSearch, paginatedResult } from "../../lib/pagination.js";
import { generateDiscountCode } from "../../lib/discountCodes.js";

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
    const search = parseSearch(req);
    const where = search
      ? { code: { contains: search, mode: "insensitive" as const } }
      : undefined;

    const pagination = parsePagination(req);
    const [items, total] = await prisma.$transaction([
      prisma.discountCode.findMany({
        where,
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
