import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { adminDeductWallet } from "../../lib/wallet.js";
import { asyncHandler } from "../../lib/asyncHandler.js";
import { buildLoyaltyStatus, getLoyaltyTiers, getPointsByCustomer } from "../../lib/loyalty.js";
import { parsePagination, parseSearch, paginatedResult } from "../../lib/pagination.js";

export const adminWalletRouter = Router();

adminWalletRouter.get(
  "/customers",
  asyncHandler(async (req, res) => {
    const search = parseSearch(req);
    const where = search
      ? {
          OR: [
            { firstName: { contains: search, mode: "insensitive" as const } },
            { lastName: { contains: search, mode: "insensitive" as const } },
            { phone: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : undefined;

    const pagination = parsePagination(req);
    const [customers, total] = await prisma.$transaction([
      prisma.customer.findMany({
        where,
        orderBy: [{ walletBalance: "desc" }, { id: "desc" }],
        include: { _count: { select: { orders: true } } },
        skip: pagination.skip,
        take: pagination.take,
      }),
      prisma.customer.count({ where }),
    ]);
    const [pointsById, tiers] = await Promise.all([
      getPointsByCustomer(customers.map((c) => c.id)),
      getLoyaltyTiers(),
    ]);
    const items = customers.map((c) => ({
      ...c,
      loyalty: buildLoyaltyStatus(pointsById.get(c.id) ?? 0, tiers),
    }));
    res.json(paginatedResult(items, total, pagination));
  }),
);

const deductSchema = z.object({
  amount: z.number().int().positive("مبلغ باید بیشتر از صفر باشد"),
});

adminWalletRouter.post(
  "/customers/:id/deduct",
  asyncHandler(async (req, res) => {
    const parsed = deductSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? "مبلغ نامعتبر است" });
      return;
    }
    const customerId = req.params.id;
    const customer = await prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer) {
      res.status(404).json({ error: "مشتری پیدا نشد" });
      return;
    }
    const balance = await adminDeductWallet(customerId, parsed.data.amount, "کسر بابت اصلاح خطای سیستمی");
    if (balance === null) {
      res.status(400).json({ error: "مبلغ نمی‌تواند از موجودی کیف پول مشتری بیشتر باشد" });
      return;
    }
    res.json({ walletBalance: balance });
  }),
);

adminWalletRouter.get(
  "/customers/:id/transactions",
  asyncHandler(async (req, res) => {
    const customerId = req.params.id;
    const pagination = parsePagination(req);
    const [transactions, total] = await prisma.$transaction([
      prisma.walletTransaction.findMany({
        where: { customerId },
        orderBy: { createdAt: "desc" },
        skip: pagination.skip,
        take: pagination.take,
      }),
      prisma.walletTransaction.count({ where: { customerId } }),
    ]);
    res.json(paginatedResult(transactions, total, pagination));
  }),
);
