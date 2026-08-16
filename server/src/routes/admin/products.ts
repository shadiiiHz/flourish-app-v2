import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { asyncHandler } from "../../lib/asyncHandler.js";
import { parsePagination, parseSearch, paginatedResult } from "../../lib/pagination.js";

export const adminProductsRouter = Router();

const bulkDeleteSchema = z.object({ ids: z.array(z.string().min(1)).min(1) });

const variantSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1),
  description: z.string().optional(),
  price: z.number().int().nonnegative(),
  weight: z.string().optional(),
  stock: z.number().int().nonnegative().optional(),
  image: z.string().optional(),
});

const productSchema = z.object({
  categoryId: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  price: z.number().int().nonnegative(),
  images: z.array(z.string()).optional(),
  weight: z.string().optional(),
  ingredients: z.string().optional(),
  servingSize: z.string().optional(),
  discountPercent: z.number().int().min(0).max(100).optional(),
  stock: z.number().int().nonnegative().nullable().optional(),
  isNew: z.boolean().optional(),
  isAvailable: z.boolean().optional(),
  allowPreorder: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
  variants: z.array(variantSchema).optional(),
});

adminProductsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const search = parseSearch(req);
    const where = search
      ? {
          OR: [
            { title: { contains: search, mode: "insensitive" as const } },
            { description: { contains: search, mode: "insensitive" as const } },
            { category: { title: { contains: search, mode: "insensitive" as const } } },
          ],
        }
      : undefined;

    const pagination = parsePagination(req);
    const [products, total] = await prisma.$transaction([
      prisma.product.findMany({
        where,
        orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
        include: { variants: true, category: true },
        skip: pagination.skip,
        take: pagination.take,
      }),
      prisma.product.count({ where }),
    ]);
    res.json(paginatedResult(products, total, pagination));
  }),
);

adminProductsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const parsed = productSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "اطلاعات محصول نامعتبر است" });
      return;
    }
    const { variants, ...data } = parsed.data;
    const product = await prisma.product.create({
      data: {
        ...data,
        variants: variants ? { create: variants.map(({ id: _id, ...v }) => v) } : undefined,
      },
      include: { variants: true, category: true },
    });
    res.status(201).json(product);
  }),
);

adminProductsRouter.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const parsed = productSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "اطلاعات محصول نامعتبر است" });
      return;
    }
    const { variants, ...data } = parsed.data;

    const product = await prisma.$transaction(async (tx) => {
      if (variants) {
        await tx.productVariant.deleteMany({ where: { productId: req.params.id } });
      }
      return tx.product.update({
        where: { id: req.params.id },
        data: {
          ...data,
          variants: variants
            ? { create: variants.map(({ id: _id, ...v }) => v) }
            : undefined,
        },
        include: { variants: true, category: true },
      });
    });

    res.json(product);
  }),
);

adminProductsRouter.delete(
  "/bulk",
  asyncHandler(async (req, res) => {
    const parsed = bulkDeleteSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "شناسه‌های نامعتبر" });
      return;
    }
    await prisma.product.deleteMany({ where: { id: { in: parsed.data.ids } } });
    res.status(204).end();
  }),
);

adminProductsRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    await prisma.product.delete({ where: { id: req.params.id } });
    res.status(204).end();
  }),
);
