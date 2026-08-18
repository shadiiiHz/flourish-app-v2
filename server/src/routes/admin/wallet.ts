import { Router } from "express";
import { prisma } from "../../lib/prisma.js";
import { asyncHandler } from "../../lib/asyncHandler.js";
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
    res.json(paginatedResult(customers, total, pagination));
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
