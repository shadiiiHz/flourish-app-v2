import { Router } from "express";
import multer from "multer";
import { parse as parseCsv } from "csv-parse/sync";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { asyncHandler } from "../../lib/asyncHandler.js";
import { parsePagination, parseSearch, paginatedResult } from "../../lib/pagination.js";
import { deleteUploadedFiles } from "../../lib/uploads.js";
import { syncProductVariants } from "../../lib/variants.js";
import { validateVariantStockSum } from "../../lib/variantStock.js";

export const adminProductsRouter = Router();

const bulkImportUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
});

const bulkDeleteSchema = z.object({ ids: z.array(z.string().min(1)).min(1) });

export const variantSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1),
  description: z.string().nullable().optional(),
  price: z.number().int().nonnegative(),
  weight: z.string().nullable().optional(),
  stock: z.number().int().nonnegative().nullable().optional(),
  image: z.string().nullable().optional(),
});

const productSchema = z.object({
  categoryId: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  price: z.number().int().nonnegative(),
  images: z.array(z.string()).optional(),
  weight: z.string().nullable().optional(),
  ingredients: z.string().nullable().optional(),
  servingSize: z.string().nullable().optional(),
  discountPercent: z.number().int().min(0).max(100).nullable().optional(),
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
    // Combo products (no category, homepage-only) are managed on their own
    // admin tab — never mix them into the regular catalog product list.
    const where: Prisma.ProductWhereInput = {
      isCombo: false,
      ...(search
        ? {
            OR: [
              { title: { contains: search, mode: "insensitive" as const } },
              { description: { contains: search, mode: "insensitive" as const } },
              { category: { title: { contains: search, mode: "insensitive" as const } } },
            ],
          }
        : {}),
    };

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
    const stockError = validateVariantStockSum(data.stock, variants ?? []);
    if (stockError) {
      res.status(400).json({ error: stockError });
      return;
    }
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

const BOOLEAN_TRUE = new Set(["بله", "yes", "true", "1", "y"]);
const BOOLEAN_FALSE = new Set(["خیر", "no", "false", "0", "n"]);

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  const v = (value ?? "").trim().toLowerCase();
  if (!v) return fallback;
  if (BOOLEAN_TRUE.has(v)) return true;
  if (BOOLEAN_FALSE.has(v)) return false;
  return fallback;
}

function parseOptionalInt(value: string | undefined): number | undefined {
  const v = (value ?? "").trim();
  if (!v) return undefined;
  const n = Number(v.replace(/,/g, ""));
  return Number.isFinite(n) ? Math.round(n) : undefined;
}

interface BulkImportError {
  row: number;
  message: string;
}

const WEIGHT_PATTERN = /^\d+(?:\.\d+)?\s*(گرم|کیلوگرم)$/;

/** Weight is free text elsewhere, but the app only ever offers گرم/کیلوگرم as units. */
function parseWeight(raw: string | undefined): { ok: true; value?: string } | { ok: false } {
  const value = (raw ?? "").trim();
  if (!value) return { ok: true, value: undefined };
  if (!WEIGHT_PATTERN.test(value)) return { ok: false };
  return { ok: true, value };
}

/**
 * "انواع محصول" column syntax: variants separated by `;`, each variant's
 * fields separated by `:` as عنوان:قیمت:وزن:موجودی (وزن and موجودی optional).
 * e.g. "کوچک:85000:90 گرم:12;بزرگ:110000:150 گرم:8"
 */
function parseVariantsColumn(
  raw: string | undefined,
): { variants: Prisma.ProductVariantCreateWithoutProductInput[] } | { error: string } {
  const value = (raw ?? "").trim();
  if (!value) return { variants: [] };

  const variants: Prisma.ProductVariantCreateWithoutProductInput[] = [];
  for (const chunk of value.split(";")) {
    const part = chunk.trim();
    if (!part) continue;
    const [titleRaw, priceRaw, weightRaw, stockRaw] = part.split(":");
    const title = (titleRaw ?? "").trim();
    if (!title) return { error: `عنوان نوع نامعتبر است: «${part}»` };
    const price = parseOptionalInt(priceRaw);
    if (price == null || price < 0) return { error: `قیمت نوع «${title}» نامعتبر است` };
    const weight = parseWeight(weightRaw);
    if (!weight.ok) {
      return { error: `وزن نوع «${title}» باید به شکل «عدد گرم» یا «عدد کیلوگرم» باشد` };
    }
    variants.push({
      title,
      price,
      weight: weight.value,
      stock: parseOptionalInt(stockRaw),
    });
  }
  return { variants };
}

adminProductsRouter.post(
  "/bulk-import",
  bulkImportUpload.single("file"),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      res.status(400).json({ error: "فایلی ارسال نشد" });
      return;
    }

    let rows: Record<string, string>[];
    try {
      rows = parseCsv(req.file.buffer, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        bom: true,
      });
    } catch {
      res.status(400).json({ error: "فایل CSV قابل خواندن نیست" });
      return;
    }
    if (rows.length === 0) {
      res.status(400).json({ error: "فایل خالی است" });
      return;
    }

    const categories = await prisma.category.findMany();
    const categoryBySlug = new Map(categories.map((c) => [c.slug.toLowerCase(), c]));
    const categoryByTitle = new Map(categories.map((c) => [c.title.toLowerCase(), c]));

    const errors: BulkImportError[] = [];
    const toCreate: { row: number; data: Prisma.ProductCreateInput }[] = [];

    rows.forEach((row, index) => {
      const rowNumber = index + 2; // +1 for header row, +1 for 1-based numbering
      const title = (row["عنوان"] ?? "").trim();
      const categoryLabel = (row["دسته‌بندی"] ?? "").trim();
      const priceRaw = row["قیمت"];

      if (!title) {
        errors.push({ row: rowNumber, message: "عنوان الزامی است" });
        return;
      }
      if (!categoryLabel) {
        errors.push({ row: rowNumber, message: "دسته‌بندی الزامی است" });
        return;
      }
      const category =
        categoryBySlug.get(categoryLabel.toLowerCase()) ??
        categoryByTitle.get(categoryLabel.toLowerCase());
      if (!category) {
        errors.push({ row: rowNumber, message: `دسته‌بندی «${categoryLabel}» یافت نشد` });
        return;
      }
      const price = parseOptionalInt(priceRaw);
      if (price == null || price < 0) {
        errors.push({ row: rowNumber, message: "قیمت نامعتبر است" });
        return;
      }
      const discountPercent = parseOptionalInt(row["درصد تخفیف"]);
      if (discountPercent != null && (discountPercent < 0 || discountPercent > 100)) {
        errors.push({ row: rowNumber, message: "درصد تخفیف باید بین ۰ تا ۱۰۰ باشد" });
        return;
      }
      const weight = parseWeight(row["وزن"]);
      if (!weight.ok) {
        errors.push({ row: rowNumber, message: "وزن باید به شکل «عدد گرم» یا «عدد کیلوگرم» باشد" });
        return;
      }
      const variantsResult = parseVariantsColumn(row["انواع محصول"]);
      if ("error" in variantsResult) {
        errors.push({ row: rowNumber, message: variantsResult.error });
        return;
      }

      toCreate.push({
        row: rowNumber,
        data: {
          category: { connect: { id: category.id } },
          title,
          description: (row["توضیحات"] ?? "").trim(),
          price,
          weight: weight.value,
          ingredients: (row["ترکیبات"] ?? "").trim() || undefined,
          servingSize: (row["مناسب برای"] ?? "").trim() || undefined,
          discountPercent,
          stock: parseOptionalInt(row["موجودی"]) ?? null,
          isNew: parseBoolean(row["جدید"], false),
          isAvailable: parseBoolean(row["موجود"], true),
          allowPreorder: parseBoolean(row["پیش‌سفارش"], true),
          variants: variantsResult.variants.length
            ? { create: variantsResult.variants }
            : undefined,
        },
      });
    });

    let createdCount = 0;
    for (const { row, data } of toCreate) {
      try {
        await prisma.product.create({ data });
        createdCount += 1;
      } catch {
        errors.push({ row, message: "خطا در ذخیره‌سازی این ردیف" });
      }
    }

    errors.sort((a, b) => a.row - b.row);
    res.status(201).json({ createdCount, errors });
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

    // Fetched pre-update only when something that carries images is being
    // replaced, so we know which files dropped out and can delete those —
    // and only those; a PUT that omits `images`/`variants` leaves them
    // untouched, so nothing of that kind should be swept.
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
      await tx.product.update({ where: { id: req.params.id }, data });
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
        include: { variants: true, category: true },
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

adminProductsRouter.delete(
  "/bulk",
  asyncHandler(async (req, res) => {
    const parsed = bulkDeleteSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "شناسه‌های نامعتبر" });
      return;
    }
    const products = await prisma.product.findMany({
      where: { id: { in: parsed.data.ids } },
      include: { variants: { select: { image: true } } },
    });
    await prisma.product.deleteMany({ where: { id: { in: parsed.data.ids } } });
    await deleteUploadedFiles([
      ...products.flatMap((p) => p.images),
      ...products.flatMap((p) => p.variants.map((v) => v.image)),
    ]);
    res.status(204).end();
  }),
);

adminProductsRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const product = await prisma.product.delete({
      where: { id: req.params.id },
      include: { variants: { select: { image: true } } },
    });
    await deleteUploadedFiles([...product.images, ...product.variants.map((v) => v.image)]);
    res.status(204).end();
  }),
);
