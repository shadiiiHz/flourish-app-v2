import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { asyncHandler } from "../../lib/asyncHandler.js";
import { parsePagination, paginatedResult } from "../../lib/pagination.js";
import { createBirthdayDiscountCode } from "../../lib/birthdayDiscount.js";

export const adminMessagesRouter = Router();

adminMessagesRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const pagination = parsePagination(req);
    const [items, total] = await prisma.$transaction([
      prisma.adminMessage.findMany({
        include: {
          customer: { select: { id: true, phone: true, firstName: true, lastName: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: pagination.skip,
        take: pagination.take,
      }),
      prisma.adminMessage.count(),
    ]);
    res.json(paginatedResult(items, total, pagination));
  }),
);

adminMessagesRouter.get(
  "/unread-count",
  asyncHandler(async (_req, res) => {
    const count = await prisma.adminMessage.count({ where: { isRead: false } });
    res.json({ count });
  }),
);

adminMessagesRouter.patch(
  "/:id/read",
  asyncHandler(async (req, res) => {
    const message = await prisma.adminMessage.update({
      where: { id: req.params.id },
      data: { isRead: true },
    });
    res.json(message);
  }),
);

const birthdayDiscountSchema = z.object({
  percent: z.number().int().min(1).max(100),
});

adminMessagesRouter.post(
  "/:id/birthday-discount",
  asyncHandler(async (req, res) => {
    const parsed = birthdayDiscountSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "درصد تخفیف نامعتبر است" });
      return;
    }
    const message = await prisma.adminMessage.findUnique({ where: { id: req.params.id } });
    if (!message || message.type !== "birthday" || !message.customerId) {
      res.status(404).json({ error: "پیام یافت نشد" });
      return;
    }
    if (message.actionedAt) {
      res.status(409).json({ error: "برای این پیام قبلاً کد تخفیف ایجاد شده است" });
      return;
    }
    const discountCode = await createBirthdayDiscountCode(
      message.customerId,
      parsed.data.percent,
      message.id,
    );
    res.status(201).json(discountCode);
  }),
);
