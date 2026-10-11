import { Router } from "express";
import { prisma } from "../../lib/prisma.js";
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
