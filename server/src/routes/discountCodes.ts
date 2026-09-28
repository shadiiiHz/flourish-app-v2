import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { requireCustomerAuth } from "../middleware/requireCustomerAuth.js";

export const discountCodesRouter = Router();

const validateSchema = z.object({ code: z.string().trim().min(1) });

discountCodesRouter.post(
  "/validate",
  requireCustomerAuth,
  asyncHandler(async (req, res) => {
    const parsed = validateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "کد تخفیف نامعتبر است" });
      return;
    }
    const code = parsed.data.code.toUpperCase();
    const discount = await prisma.discountCode.findUnique({ where: { code } });
    if (!discount || !discount.isActive) {
      res.status(404).json({ error: "کد تخفیف معتبر نیست" });
      return;
    }
    // Same rules the order route enforces — otherwise checkout would accept a
    // code here that placing the order then rejects.
    if (discount.customerId && discount.customerId !== req.customer!.sub) {
      res.status(400).json({ error: "این کد تخفیف مخصوص شما نیست" });
      return;
    }
    if (discount.usedAt) {
      res.status(400).json({ error: "این کد تخفیف قبلاً استفاده شده است" });
      return;
    }
    if (discount.expiresAt && discount.expiresAt.getTime() < Date.now()) {
      res.status(400).json({ error: "این کد تخفیف منقضی شده است" });
      return;
    }
    res.json({ code: discount.code, percent: discount.percent });
  }),
);
