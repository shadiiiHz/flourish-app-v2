import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { asyncHandler } from "../../lib/asyncHandler.js";
import { parsePagination, parseSearch, paginatedResult } from "../../lib/pagination.js";
import { deleteUploadedFile, deleteUploadedFiles } from "../../lib/uploads.js";

export const adminCategoriesRouter = Router();

const bulkDeleteSchema = z.object({ ids: z.array(z.string().min(1)).min(1) });

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

    const search = parseSearch(req);
    const where = search
      ? {
          OR: [
            { title: { contains: search, mode: "insensitive" as const } },
            { slug: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : undefined;

    const pagination = parsePagination(req);
    const [categories, total] = await prisma.$transaction([
      prisma.category.findMany({
        where,
        orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
        include: { _count: { select: { products: true } } },
        skip: pagination.skip,
        take: pagination.take,
      }),
      prisma.category.count({ where }),
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
    const previous = await prisma.category.findUnique({ where: { id: req.params.id } });
    const category = await prisma.category.update({
      where: { id: req.params.id },
      data: parsed.data,
    });
    if (parsed.data.image !== undefined && previous?.image && previous.image !== category.image) {
      await deleteUploadedFile(previous.image);
    }
    res.json(category);
  }),
);

adminCategoriesRouter.delete(
  "/bulk",
  asyncHandler(async (req, res) => {
    const parsed = bulkDeleteSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "شناسه‌های نامعتبر" });
      return;
    }
    const categories = await prisma.category.findMany({
      where: { id: { in: parsed.data.ids } },
      select: { image: true },
    });
    await prisma.category.deleteMany({ where: { id: { in: parsed.data.ids } } });
    await deleteUploadedFiles(categories.map((c) => c.image));
    res.status(204).end();
  }),
);

adminCategoriesRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const category = await prisma.category.delete({ where: { id: req.params.id } });
    await deleteUploadedFile(category.image);
    res.status(204).end();
  }),
);
