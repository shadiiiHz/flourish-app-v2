import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { getSettings } from "../lib/shipping.js";

export const catalogRouter = Router();

catalogRouter.get(
  "/settings/status",
  asyncHandler(async (_req, res) => {
    const settings = await getSettings();
    res.json({
      siteClosed: settings.siteClosed,
      walletCashbackPercent: settings.walletCashbackPercent,
      menuBannerImage: settings.menuBannerImage,
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
          include: { variants: true },
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
      include: { variants: true, category: true },
    });
    res.json(products);
  }),
);
