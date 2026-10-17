import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { getSettings } from "../lib/shipping.js";
import { isSiteOpen } from "../lib/businessHours.js";
import { DECAY_PERIOD_MONTHS, TOMAN_PER_POINT, getLoyaltyTiers } from "../lib/loyalty.js";
import { CASHBACK_EXPIRY_DAYS } from "../lib/wallet.js";

export const catalogRouter = Router();

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
          include: { variants: true, addons: addonsInclude },
        },
      },
    });
    res.json(categories);
  }),
);

catalogRouter.get(
  "/products/new",
  asyncHandler(async (_req, res) => {
    const products = await prisma.product.findMany({
      where: { isNew: true },
      orderBy: { sortOrder: "asc" },
      include: { variants: true, category: true, addons: addonsInclude },
    });
    res.json(products);
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
        include: { variants: true, category: true, addons: addonsInclude },
      }),
    ]);
    res.json({ theme: settings.seasonalTheme, products });
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
