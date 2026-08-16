import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { asyncHandler } from "../../lib/asyncHandler.js";
import { getSettings } from "../../lib/shipping.js";

export const adminSettingsRouter = Router();

const settingsSchema = z.object({
  shippingCostUpTo5Km: z.number().int().nonnegative(),
  shippingCostOver5Km: z.number().int().nonnegative(),
  siteClosed: z.boolean().optional(),
});

adminSettingsRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const settings = await getSettings();
    res.json(settings);
  }),
);

adminSettingsRouter.put(
  "/",
  asyncHandler(async (req, res) => {
    const parsed = settingsSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "اطلاعات تنظیمات نامعتبر است" });
      return;
    }
    const settings = await prisma.settings.upsert({
      where: { id: 1 },
      update: parsed.data,
      create: { id: 1, ...parsed.data },
    });
    res.json(settings);
  }),
);
