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
import { syncDependentStock } from "../../lib/stock.js";

export const adminProductsRouter = Router();

const bulkImportUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
});

/** The database is remote, so a product save (many small queries) can outlast Prisma's 5s default. */
const LONG_TRANSACTION = { timeout: 30_000, maxWait: 10_000 };

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
  /** Makes this a dependent product: no own inventory, it draws 1:1 from this parent product's stock. */
  stockSourceId: z.string().min(1).nullable().optional(),
  isNew: z.boolean().optional(),
  isSeasonal: z.boolean().optional(),
  isAvailable: z.boolean().optional(),
  allowPreorder: z.boolean().optional(),
  /** Weekdays (0=Sunday … 6=Saturday) this product can be preordered for. Empty means every day. */
  preorderWeekdays: z
    .array(z.number().int().min(0).max(6))
    .transform((days) => [...new Set(days)].sort((a, b) => a - b))
    .optional(),
  /** Replaces discountPercent for preorders. Null means preorders get the regular discount. */
  preorderDiscountPercent: z.number().int().min(0).max(100).nullable().optional(),
  pickupOnly: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
  variants: z.array(variantSchema).optional(),
  /** Addons customers may tick when adding this product to their cart. */
  addonIds: z.array(z.string().min(1)).optional(),
  /** Parent side of the stock link: the full set of products that draw their stock 1:1 from this one. Omit to leave links untouched. */
  dependentIds: z.array(z.string().min(1)).optional(),
});

/**
 * Checks that `sourceId` may act as the parent of a dependent product and
 * returns the parent's current stock (which the dependent mirrors). Parents
 * must be plain catalog products: no variants (their stock is split per
 * variant, which can't be mirrored 1:1), not themselves dependents (no
 * chains), and not combo items. A product that already has dependents of its
 * own can't become a dependent. A dependent itself may have variants — each
 * one mirrors the parent's stock.
 */
async function resolveStockSource(
  productId: string | null,
  sourceId: string,
): Promise<{ stock: number | null } | { error: string }> {
  if (productId && sourceId === productId) return { error: "محصول نمی‌تواند به خودش وابسته باشد" };
  const parent = await prisma.product.findUnique({
    where: { id: sourceId },
    select: { stock: true, stockSourceId: true, isCombo: true, _count: { select: { variants: true } } },
  });
  if (!parent) return { error: "محصول مادر یافت نشد" };
  if (parent.isCombo) return { error: "محصول کمبو نمی‌تواند محصول مادر باشد" };
  if (parent._count.variants > 0) return { error: "محصولی که دارای انواع است نمی‌تواند محصول مادر باشد" };
  if (parent.stockSourceId) return { error: "محصول مادر خودش نمی‌تواند به محصول دیگری وابسته باشد" };
  if (productId) {
    const dependents = await prisma.product.count({ where: { stockSourceId: productId } });
    if (dependents > 0) {
      return { error: "این محصول خودش مادر محصولات دیگر است و نمی‌تواند وابسته باشد" };
    }
  }
  return { stock: parent.stock };
}

const productInclude = { variants: true, category: true, addons: { select: { addonId: true } } } as const;

const productStatusValues = ["available", "unavailable"] as const;
type ProductStatusFilter = (typeof productStatusValues)[number];

function parseProductStatus(req: Parameters<typeof parseSearch>[0]): ProductStatusFilter | undefined {
  const value = req.query.status;
  return typeof value === "string" && (productStatusValues as readonly string[]).includes(value)
    ? (value as ProductStatusFilter)
    : undefined;
}

adminProductsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const search = parseSearch(req);
    const categoryId = typeof req.query.categoryId === "string" ? req.query.categoryId : undefined;
    const status = parseProductStatus(req);
    // Combo products (no category, homepage-only) are managed on their own
    // admin tab and normally never mix into the regular catalog product
    // list — except the manual-order product search, which opts in via
    // includeCombo since a combo is a valid order line item too.
    const includeCombo = req.query.includeCombo === "true";
    // Each filter is its own entry in AND rather than spread into the same
    // object, since the search and status filters each need their own OR —
    // merging them at the top level would let one silently clobber the other.
    const where: Prisma.ProductWhereInput = {
      ...(includeCombo ? {} : { isCombo: false }),
      ...(categoryId ? { categoryId } : {}),
      AND: [
        ...(search
          ? [
              {
                OR: [
                  { title: { contains: search, mode: "insensitive" as const } },
                  { description: { contains: search, mode: "insensitive" as const } },
                  { category: { title: { contains: search, mode: "insensitive" as const } } },
                ],
              },
            ]
          : []),
        // Mirrors isEffectivelyAvailable on the admin frontend: a product
        // toggled available can still be effectively out of stock, and that
        // should count as "unavailable" here too, not just isAvailable itself.
        ...(status === "available"
          ? [{ isAvailable: true, OR: [{ stock: null }, { stock: { not: 0 } }] }]
          : status === "unavailable"
            ? [{ OR: [{ isAvailable: false }, { stock: 0 }] }]
            : []),
      ],
    };

    const pagination = parsePagination(req);
    const [products, total] = await prisma.$transaction([
      prisma.product.findMany({
        where,
        orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
        include: productInclude,
        skip: pagination.skip,
        take: pagination.take,
      }),
      prisma.product.count({ where }),
    ]);
    res.json(paginatedResult(products, total, pagination));
  }),
);

/** Every catalog product with what the "dependent products" picker needs to decide who can be linked. */
adminProductsRouter.get(
  "/stock-candidates",
  asyncHandler(async (_req, res) => {
    const products = await prisma.product.findMany({
      where: { isCombo: false },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      select: {
        id: true,
        title: true,
        images: true,
        stock: true,
        stockSourceId: true,
        category: { select: { title: true } },
        _count: { select: { variants: true, stockDependents: true } },
      },
    });
    res.json(
      products.map((p) => ({
        id: p.id,
        title: p.title,
        image: p.images[0] ?? null,
        categoryTitle: p.category?.title ?? null,
        stock: p.stock,
        stockSourceId: p.stockSourceId,
        variantCount: p._count.variants,
        dependentCount: p._count.stockDependents,
      })),
    );
  }),
);

/**
 * One page of stock parents (products that still have at least one dependent),
 * each with its dependents embedded. A parent whose last dependent is removed
 * simply stops matching and drops off the list.
 */
adminProductsRouter.get(
  "/relations",
  asyncHandler(async (req, res) => {
    const search = parseSearch(req);
    const where: Prisma.ProductWhereInput = {
      isCombo: false,
      stockDependents: { some: {} },
      ...(search
        ? {
            OR: [
              { title: { contains: search, mode: "insensitive" as const } },
              { stockDependents: { some: { title: { contains: search, mode: "insensitive" as const } } } },
            ],
          }
        : {}),
    };
    const pagination = parsePagination(req);
    const [parents, total] = await prisma.$transaction([
      prisma.product.findMany({
        where,
        orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
        skip: pagination.skip,
        take: pagination.take,
        select: {
          id: true,
          title: true,
          images: true,
          stock: true,
          category: { select: { title: true } },
          stockDependents: {
            orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
            select: { id: true, title: true },
          },
        },
      }),
      prisma.product.count({ where }),
    ]);
    res.json(
      paginatedResult(
        parents.map((p) => ({
          id: p.id,
          title: p.title,
          image: p.images[0] ?? null,
          categoryTitle: p.category?.title ?? null,
          stock: p.stock,
          children: p.stockDependents,
        })),
        total,
        pagination,
      ),
    );
  }),
);

/**
 * Validates the set of products to attach as dependents of `parentId` (null
 * while the parent is still being created). The parent must be a plain
 * product — no variants, not itself a dependent. Each dependent must be a
 * non-combo product that isn't a parent of others and isn't already tied to a
 * different parent.
 */
async function validateDependents(
  parentId: string | null,
  ids: string[],
  parent: { variantCount: number; stockSourceId: string | null },
): Promise<string | null> {
  if (ids.length === 0) return null;
  if (parentId && ids.includes(parentId)) return "محصول نمی‌تواند به خودش وابسته باشد";
  if (parent.variantCount > 0) return "محصولی که دارای انواع است نمی‌تواند محصول مادر باشد";
  if (parent.stockSourceId) return "این محصول خودش به محصول دیگری وابسته است و نمی‌تواند مادر باشد";
  const children = await prisma.product.findMany({
    where: { id: { in: ids } },
    select: { id: true, title: true, isCombo: true, stockSourceId: true, _count: { select: { stockDependents: true } } },
  });
  if (children.length !== ids.length) return "برخی از محصولات وابسته یافت نشدند";
  for (const child of children) {
    if (child.isCombo) return `«${child.title}» کمبو است و نمی‌تواند وابسته باشد`;
    if (child._count.stockDependents > 0) return `«${child.title}» خودش مادر محصولات دیگر است`;
    if (child.stockSourceId && child.stockSourceId !== parentId) {
      return `«${child.title}» به محصول مادر دیگری وابسته است`;
    }
  }
  return null;
}

/** Makes `ids` exactly the dependents of `parentId` (unlinking the rest) and mirrors the parent's stock onto them and their variants. */
async function applyDependents(tx: Prisma.TransactionClient, parentId: string, ids: string[]) {
  await tx.product.updateMany({
    where: { stockSourceId: parentId, id: { notIn: ids } },
    data: { stockSourceId: null },
  });
  await tx.product.updateMany({ where: { id: { in: ids } }, data: { stockSourceId: parentId } });
  await syncDependentStock(tx, [parentId]);
}

adminProductsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const parsed = productSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "اطلاعات محصول نامعتبر است" });
      return;
    }
    const { variants: _variants, addonIds, dependentIds, ...data } = parsed.data;
    let variants = parsed.data.variants;
    const dependentError = await validateDependents(null, dependentIds ?? [], {
      variantCount: variants?.length ?? 0,
      stockSourceId: data.stockSourceId ?? null,
    });
    if (dependentError) {
      res.status(400).json({ error: dependentError });
      return;
    }
    if (data.stockSourceId) {
      const source = await resolveStockSource(null, data.stockSourceId);
      if ("error" in source) {
        res.status(400).json({ error: source.error });
        return;
      }
      data.stock = source.stock;
      // Each variant of a dependent mirrors the parent's stock too.
      variants = variants?.map((v) => ({ ...v, stock: source.stock }));
    }
    const stockError = data.stockSourceId ? null : validateVariantStockSum(data.stock, variants ?? []);
    if (stockError) {
      res.status(400).json({ error: stockError });
      return;
    }
    const product = await prisma.product.create({
      data: {
        ...data,
        variants: variants ? { create: variants.map(({ id: _id, ...v }) => v) } : undefined,
        addons: addonIds?.length
          ? { create: [...new Set(addonIds)].map((addonId) => ({ addonId })) }
          : undefined,
      },
      include: productInclude,
    });
    if (dependentIds?.length) {
      await prisma.$transaction((tx) => applyDependents(tx, product.id, dependentIds), LONG_TRANSACTION);
    }
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
          pickupOnly: parseBoolean(row["فقط تحویل حضوری"], false),
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

/** Replaces the full set of products that draw their stock from `:id`. An empty list unlinks them all. */
adminProductsRouter.put(
  "/:id/dependents",
  asyncHandler(async (req, res) => {
    const parsed = z.object({ dependentIds: z.array(z.string().min(1)) }).safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "اطلاعات نامعتبر است" });
      return;
    }
    const dependentIds = [...new Set(parsed.data.dependentIds)];
    const parent = await prisma.product.findUnique({
      where: { id: req.params.id },
      select: { stockSourceId: true, isCombo: true, _count: { select: { variants: true } } },
    });
    if (!parent || parent.isCombo) {
      res.status(404).json({ error: "محصول یافت نشد" });
      return;
    }
    const error = await validateDependents(req.params.id, dependentIds, {
      variantCount: parent._count.variants,
      stockSourceId: parent.stockSourceId,
    });
    if (error) {
      res.status(400).json({ error });
      return;
    }
    await prisma.$transaction((tx) => applyDependents(tx, req.params.id, dependentIds), LONG_TRANSACTION);
    res.json({ ok: true });
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
    const { variants: _variants, addonIds, dependentIds, ...data } = parsed.data;
    let variants = parsed.data.variants;

    // Fetched pre-update so we know which image files dropped out and can
    // delete those — and only those; a PUT that omits `images`/`variants`
    // leaves them untouched, so nothing of that kind is swept — and to check
    // the product's current stock-dependency links.
    const previous = await prisma.product.findUnique({
      where: { id: req.params.id },
      include: { variants: true },
    });

    let mirroredStock: { stock: number | null } | null = null;
    const effectiveSourceId =
      data.stockSourceId !== undefined ? data.stockSourceId : (previous?.stockSourceId ?? null);
    if (effectiveSourceId) {
      const source = await resolveStockSource(req.params.id, effectiveSourceId);
      if ("error" in source) {
        res.status(400).json({ error: source.error });
        return;
      }
      // A dependent has no inventory of its own — whatever stock the form sent is ignored,
      // and its variants mirror the parent's stock as well.
      data.stock = source.stock;
      mirroredStock = source;
      variants = variants?.map((v) => ({ ...v, stock: source.stock }));
    }

    // Parent side: the product being saved must be a plain product to have dependents.
    const existingDependentCount = await prisma.product.count({
      where: { stockSourceId: req.params.id },
    });
    const finalDependentCount =
      dependentIds !== undefined ? dependentIds.length : existingDependentCount;
    if (finalDependentCount > 0) {
      const dependentError = await validateDependents(req.params.id, dependentIds ?? [], {
        variantCount: variants ? variants.length : (previous?.variants.length ?? 0),
        stockSourceId: effectiveSourceId,
      });
      if (dependentError) {
        res.status(400).json({ error: dependentError });
        return;
      }
      const effectiveVariantCount = variants ? variants.length : (previous?.variants.length ?? 0);
      if (effectiveVariantCount > 0 || effectiveSourceId) {
        res.status(400).json({
          error: effectiveSourceId
            ? "این محصول خودش وابسته است و نمی‌تواند مادر باشد"
            : "این محصول مادر محصولات دیگر است و نمی‌تواند دارای انواع باشد",
        });
        return;
      }
    }

    if (variants && !mirroredStock) {
      const effectiveStock = data.stock !== undefined ? data.stock : previous?.stock;
      const stockError = validateVariantStockSum(effectiveStock, variants);
      if (stockError) {
        res.status(400).json({ error: stockError });
        return;
      }
    }

    const product = await prisma.$transaction(async (tx) => {
      await tx.product.update({ where: { id: req.params.id }, data });
      // Only touch dependents when there is something to link, unlink or keep in sync — every
      // extra query here is a round trip to the remote database inside the transaction.
      if (dependentIds !== undefined && (dependentIds.length > 0 || existingDependentCount > 0)) {
        await applyDependents(tx, req.params.id, dependentIds);
      } else if (existingDependentCount > 0) {
        // This product is a parent: push its (possibly just edited) stock to its dependents.
        await syncDependentStock(tx, [req.params.id]);
      }
      if (variants) {
        await syncProductVariants(
          tx,
          req.params.id,
          (previous?.variants ?? []).map((v) => v.id),
          variants,
        );
      }
      if (mirroredStock) {
        // Covers variants that exist but weren't part of this payload (e.g. just linked to a parent).
        await tx.productVariant.updateMany({
          where: { productId: req.params.id },
          data: { stock: mirroredStock.stock },
        });
      }
      if (addonIds) {
        await tx.productAddon.deleteMany({ where: { productId: req.params.id } });
        await tx.productAddon.createMany({
          data: [...new Set(addonIds)].map((addonId) => ({ productId: req.params.id, addonId })),
        });
      }
      return tx.product.findUniqueOrThrow({
        where: { id: req.params.id },
        include: productInclude,
      });
    }, LONG_TRANSACTION);

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
