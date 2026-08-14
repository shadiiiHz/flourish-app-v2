import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { asyncHandler } from "../../lib/asyncHandler.js";
import { parsePagination, paginatedResult } from "../../lib/pagination.js";

export const adminCategoriesRouter = Router();

const categorySchema = z.object({
  slug: z.string().min(1),
  tab: z.enum(["bakery", "drinks"]),
  title: z.string().min(1),
  image: z.string().optional(),
  note: z.string().optional(),
  sortOrder: z.number().int().optional(),
});

adminCategoriesRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    if (req.query.all === "true") {
      const categories = await prisma.category.findMany({
        orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
        include: { _count: { select: { products: true } } },
      });
      res.json(categories);
      return;
    }

    const pagination = parsePagination(req);
    const [categories, total] = await prisma.$transaction([
      prisma.category.findMany({
        orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
        include: { _count: { select: { products: true } } },
        skip: pagination.skip,
        take: pagination.take,
      }),
      prisma.category.count(),
    ]);
    res.json(paginatedResult(categories, total, pagination));
  }),
);

adminCategoriesRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const parsed = categorySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "اطلاعات دسته‌بندی نامعتبر است" });
      return;
    }
    const category = await prisma.category.create({ data: parsed.data });
    res.status(201).json(category);
  }),
);

adminCategoriesRouter.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const parsed = categorySchema.partial().safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "اطلاعات دسته‌بندی نامعتبر است" });
      return;
    }
    const category = await prisma.category.update({
      where: { id: req.params.id },
      data: parsed.data,
    });
    res.json(category);
  }),
);

adminCategoriesRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    await prisma.category.delete({ where: { id: req.params.id } });
    res.status(204).end();
  }),
);
