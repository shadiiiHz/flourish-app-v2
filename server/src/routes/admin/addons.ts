import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { asyncHandler } from "../../lib/asyncHandler.js";
import { parsePagination, parseSearch, paginatedResult } from "../../lib/pagination.js";

export const adminAddonsRouter = Router();

const addonSchema = z.object({
  name: z.string().trim().min(1).max(80),
  price: z.number().int().nonnegative(),
});

const bulkDeleteSchema = z.object({ ids: z.array(z.string().min(1)).min(1) });

// Every addon, unpaginated — feeds the addon picker on the product form.
adminAddonsRouter.get(
  "/all",
  asyncHandler(async (_req, res) => {
    res.json(await prisma.addon.findMany({ orderBy: [{ name: "asc" }, { id: "asc" }] }));
  }),
);

adminAddonsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const search = parseSearch(req);
    const where = search ? { name: { contains: search, mode: "insensitive" as const } } : undefined;
    const pagination = parsePagination(req);
    const [items, total] = await prisma.$transaction([
      prisma.addon.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
        skip: pagination.skip,
        take: pagination.take,
      }),
      prisma.addon.count({ where }),
    ]);
    res.json(paginatedResult(items, total, pagination));
  }),
);

adminAddonsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const parsed = addonSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "اطلاعات افزودنی نامعتبر است" });
      return;
    }
    res.status(201).json(await prisma.addon.create({ data: parsed.data }));
  }),
);

adminAddonsRouter.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const parsed = addonSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "اطلاعات افزودنی نامعتبر است" });
      return;
    }
    const exists = await prisma.addon.findUnique({ where: { id: req.params.id } });
    if (!exists) {
      res.status(404).json({ error: "افزودنی یافت نشد" });
      return;
    }
    res.json(await prisma.addon.update({ where: { id: req.params.id }, data: parsed.data }));
  }),
);

adminAddonsRouter.delete(
  "/bulk",
  asyncHandler(async (req, res) => {
    const parsed = bulkDeleteSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "شناسه‌های نامعتبر" });
      return;
    }
    await prisma.addon.deleteMany({ where: { id: { in: parsed.data.ids } } });
    res.status(204).end();
  }),
);

adminAddonsRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    await prisma.addon.deleteMany({ where: { id: req.params.id } });
    res.status(204).end();
  }),
);
