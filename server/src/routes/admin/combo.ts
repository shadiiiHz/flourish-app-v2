import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { asyncHandler } from "../../lib/asyncHandler.js";
import { parsePagination, parseSearch, paginatedResult } from "../../lib/pagination.js";
import { deleteUploadedFiles } from "../../lib/uploads.js";
import { syncProductVariants } from "../../lib/variants.js";
import { validateVariantStockSum } from "../../lib/variantStock.js";
import { variantSchema } from "./products.js";

export const adminComboRouter = Router();

/**
 * Combo products reuse the regular Product table (isCombo=true, categoryId
 * null) so they go through the exact same cart/checkout/order machinery as
 * any other product — they just never appear on /menu and live on their own
 * admin tab and homepage section instead of a category.
 */
const comboSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  price: z.number().int().nonnegative(),
  discountPercent: z.number().int().min(0).max(100).nullable().optional(),
  images: z.array(z.string()).optional(),
  isAvailable: z.boolean().optional(),
  stock: z.number().int().nonnegative().nullable().optional(),
  pickupOnly: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
  /** ISO datetime string, or null to keep the combo up until it's manually deleted. */
  comboExpiresAt: z.string().datetime().nullable().optional(),
  /** Shows a "N days left" ribbon on the card — only meaningful when comboExpiresAt is set. */
  comboShowExpiryBadge: z.boolean().optional(),
  variants: z.array(variantSchema).optional(),
});

const bulkDeleteSchema = z.object({ ids: z.array(z.string().min(1)).min(1) });

adminComboRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const search = parseSearch(req);
    const where = {
      isCombo: true as const,
      ...(search ? { title: { contains: search, mode: "insensitive" as const } } : {}),
    };

    const pagination = parsePagination(req);
    const [products, total] = await prisma.$transaction([
      prisma.product.findMany({
        where,
        orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
        include: { variants: true },
        skip: pagination.skip,
        take: pagination.take,
      }),
      prisma.product.count({ where }),
    ]);
    res.json(paginatedResult(products, total, pagination));
  }),
);

adminComboRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const parsed = comboSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "اطلاعات کمبو نامعتبر است" });
      return;
    }
    const { comboExpiresAt, variants, ...data } = parsed.data;
    const stockError = validateVariantStockSum(data.stock, variants ?? []);
    if (stockError) {
      res.status(400).json({ error: stockError });
      return;
    }
    const product = await prisma.product.create({
      data: {
        ...data,
        isCombo: true,
        comboExpiresAt: comboExpiresAt ? new Date(comboExpiresAt) : null,
        variants: variants ? { create: variants.map(({ id: _id, ...v }) => v) } : undefined,
      },
      include: { variants: true },
    });
    res.status(201).json(product);
  }),
);

adminComboRouter.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const parsed = comboSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "اطلاعات کمبو نامعتبر است" });
      return;
    }
    const { comboExpiresAt, variants, ...data } = parsed.data;

    const previous =
      variants || data.images !== undefined
        ? await prisma.product.findUnique({
            where: { id: req.params.id },
            include: { variants: true },
          })
        : null;

    if (variants) {
      const effectiveStock = data.stock !== undefined ? data.stock : previous?.stock;
      const stockError = validateVariantStockSum(effectiveStock, variants);
      if (stockError) {
        res.status(400).json({ error: stockError });
        return;
      }
    }

    const product = await prisma.$transaction(async (tx) => {
      await tx.product.update({
        where: { id: req.params.id, isCombo: true },
        data: {
          ...data,
          ...(comboExpiresAt !== undefined
            ? { comboExpiresAt: comboExpiresAt ? new Date(comboExpiresAt) : null }
            : {}),
        },
      });
      if (variants) {
        await syncProductVariants(
          tx,
          req.params.id,
          (previous?.variants ?? []).map((v) => v.id),
          variants,
        );
      }
      return tx.product.findUniqueOrThrow({
        where: { id: req.params.id },
        include: { variants: true },
      });
    });

    const orphaned: (string | null | undefined)[] = [];
    if (data.images !== undefined && previous) {
      orphaned.push(...previous.images.filter((url) => !product.images.includes(url)));
    }
    if (variants && previous) {
      const newVariantImages = new Set(
        product.variants.map((v) => v.image).filter((v): v is string => !!v),
      );
      orphaned.push(
        ...previous.variants
          .map((v) => v.image)
          .filter((url): url is string => !!url && !newVariantImages.has(url)),
      );
    }
    await deleteUploadedFiles(orphaned);

    res.json(product);
  }),
);

adminComboRouter.delete(
  "/bulk",
  asyncHandler(async (req, res) => {
    const parsed = bulkDeleteSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "شناسه‌های نامعتبر" });
      return;
    }
    const products = await prisma.product.findMany({
      where: { id: { in: parsed.data.ids }, isCombo: true },
      include: { variants: { select: { image: true } } },
    });
    await prisma.product.deleteMany({ where: { id: { in: parsed.data.ids }, isCombo: true } });
    await deleteUploadedFiles([
      ...products.flatMap((p) => p.images),
      ...products.flatMap((p) => p.variants.map((v) => v.image)),
    ]);
    res.status(204).end();
  }),
);

adminComboRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const product = await prisma.product.delete({
      where: { id: req.params.id, isCombo: true },
      include: { variants: { select: { image: true } } },
    });
    await deleteUploadedFiles([...product.images, ...product.variants.map((v) => v.image)]);
    res.status(204).end();
  }),
);
