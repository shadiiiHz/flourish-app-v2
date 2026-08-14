import { Router } from "express";
import { prisma } from "../../lib/prisma.js";
import { asyncHandler } from "../../lib/asyncHandler.js";
import { parsePagination, parseSearch, paginatedResult } from "../../lib/pagination.js";

export const adminCustomersRouter = Router();

adminCustomersRouter.get(
  "/",
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
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        include: { _count: { select: { orders: true } } },
        skip: pagination.skip,
        take: pagination.take,
      }),
      prisma.customer.count({ where }),
    ]);
    res.json(paginatedResult(customers, total, pagination));
  }),
);

adminCustomersRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const customer = await prisma.customer.findUnique({
      where: { id: req.params.id },
      include: { orders: { include: { items: true }, orderBy: { createdAt: "desc" } } },
    });
    if (!customer) {
      res.status(404).json({ error: "مشتری یافت نشد" });
      return;
    }
    res.json(customer);
  }),
);
