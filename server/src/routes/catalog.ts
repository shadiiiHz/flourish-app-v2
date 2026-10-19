import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { getSettings } from "../lib/shipping.js";
import { isSiteOpen } from "../lib/businessHours.js";
import { DECAY_PERIOD_MONTHS, TOMAN_PER_POINT, getLoyaltyTiers } from "../lib/loyalty.js";
import { CASHBACK_EXPIRY_DAYS } from "../lib/wallet.js";
import { stockGroupId, stockGroupInclude } from "../lib/stockGroups.js";

export const catalogRouter = Router();

/**
 * Tags a product with `stockGroupId` (shared by a parent and its dependents, null when standalone) so the
 * storefront can stop a customer's cart from exceeding the pool those products share, and drops the raw count.
 */
function withStockGroup<
  T extends { id: string; stockSourceId: string | null; stock: number | null; _count?: { stockDependents: number } },
>(
  product: T,
) {
  const { _count, ...rest } = product;
  const groupId = stockGroupId(product);
  // A dependent's variants only mirror the shared pool, so serve the pool itself and never a stale copy.
  const variants =
    groupId && "variants" in rest && Array.isArray(rest.variants)
      ? rest.variants.map((v: { stock: number | null }) => ({ ...v, stock: rest.stock ?? null }))
      : undefined;
  return { ...rest, ...(variants ? { variants } : {}), stockGroupId: groupId };
}

const addonsInclude = { include: { addon: true }, orderBy: { addon: { name: "asc" } } } as const;

catalogRouter.get(
  "/settings/status",
  asyncHandler(async (_req, res) => {
    const [settings, tiers] = await Promise.all([getSettings(), getLoyaltyTiers()]);
    res.json({
      siteClosed: !isSiteOpen(settings),
      manuallyClosed: settings.siteClosed,
      businessHoursEnabled: settings.businessHoursEnabled,
      businessHoursStart: settings.businessHoursStart,
      businessHoursEnd: settings.businessHoursEnd,
      // Highest tier percent — the storefront banner advertises "up to X%".
      walletCashbackPercent: Math.max(0, ...tiers.map((t) => t.cashbackPercent)),
      menuBannerImage: settings.menuBannerImage,
    });
  }),
);

/** Public club levels — the customer-club page explains them to everyone, signed in or not. */
catalogRouter.get(
  "/loyalty/tiers",
  asyncHandler(async (_req, res) => {
    res.json({
      tiers: await getLoyaltyTiers(),
      tomanPerPoint: TOMAN_PER_POINT,
      decayPeriodMonths: DECAY_PERIOD_MONTHS,
      cashbackExpiryDays: CASHBACK_EXPIRY_DAYS,
    });
  }),
);

catalogRouter.get(
  "/hero-slides",
  asyncHandler(async (_req, res) => {
    const slides = await prisma.heroSlide.findMany({
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    });
    res.json(slides);
  }),
);

catalogRouter.get(
  "/categories",
  asyncHandler(async (_req, res) => {
    const categories = await prisma.category.findMany({
      orderBy: { sortOrder: "asc" },
      include: {
        products: {
          orderBy: { sortOrder: "asc" },
          include: { variants: true, addons: addonsInclude, ...stockGroupInclude },
        },
      },
    });
    res.json(categories.map((c) => ({ ...c, products: c.products.map(withStockGroup) })));
  }),
);

catalogRouter.get(
  "/products/new",
  asyncHandler(async (_req, res) => {
    const products = await prisma.product.findMany({
      where: { isNew: true },
      orderBy: { sortOrder: "asc" },
      include: { variants: true, category: true, addons: addonsInclude, ...stockGroupInclude },
    });
    res.json(products.map(withStockGroup));
  }),
);

/** Products flagged for the homepage seasonal section, plus the design the admin picked for it. */
catalogRouter.get(
  "/products/seasonal",
  asyncHandler(async (_req, res) => {
    const [settings, products] = await Promise.all([
      getSettings(),
      prisma.product.findMany({
        where: { isSeasonal: true, isCombo: false },
        orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
        include: { variants: true, category: true, addons: addonsInclude, ...stockGroupInclude },
      }),
    ]);
    res.json({ theme: settings.seasonalTheme, products: products.map(withStockGroup) });
  }),
);

catalogRouter.get(
  "/products/combo",
  asyncHandler(async (_req, res) => {
    const products = await prisma.product.findMany({
      where: {
        isCombo: true,
        OR: [{ comboExpiresAt: null }, { comboExpiresAt: { gt: new Date() } }],
      },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      include: { variants: true, addons: addonsInclude },
    });
    res.json(products);
  }),
);
