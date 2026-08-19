import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { asyncHandler } from "../../lib/asyncHandler.js";
import { parsePagination, parseSearch, paginatedResult } from "../../lib/pagination.js";
import { creditWalletCashback, reverseWalletCashback } from "../../lib/wallet.js";

export const adminOrdersRouter = Router();

const ORDER_STATUSES = [
  "pending",
  "confirmed",
  "preparing",
  "ready",
  "delivered",
  "cancelled",
] as const;

adminOrdersRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    const search = parseSearch(req);

    const conditions = [];
    if (status && (ORDER_STATUSES as readonly string[]).includes(status)) {
      conditions.push({ status: status as (typeof ORDER_STATUSES)[number] });
    }
    if (search) {
      const or: object[] = [
        { customerName: { contains: search, mode: "insensitive" as const } },
        { customerPhone: { contains: search, mode: "insensitive" as const } },
        { id: { contains: search, mode: "insensitive" as const } },
      ];
      // Order numbers are searched as "FL-000123", "000123", or plain "123" — strip
      // everything but digits and match the underlying integer (orderNumber is an Int
      // column, so this can't be a Prisma `contains` the way the string fields above are).
      const orderNumberDigits = search.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
      if (orderNumberDigits) {
        const orderNumber = Number(orderNumberDigits);
        if (Number.isSafeInteger(orderNumber)) {
          or.push({ orderNumber });
        }
      }
      conditions.push({ OR: or });
    }
    const where = conditions.length > 0 ? { AND: conditions } : undefined;

    const pagination = parsePagination(req);
    const [orders, total] = await prisma.$transaction([
      prisma.order.findMany({
        where,
        include: { items: true, customer: true },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: pagination.skip,
        take: pagination.take,
      }),
      prisma.order.count({ where }),
    ]);
    res.json(paginatedResult(orders, total, pagination));
  }),
);

const patchSchema = z.object({
  status: z.enum(ORDER_STATUSES),
});

const bulkDeleteSchema = z.object({ ids: z.array(z.string().min(1)).min(1) });

adminOrdersRouter.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const parsed = patchSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "وضعیت سفارش نامعتبر است" });
      return;
    }
    const order = await prisma.order.update({
      where: { id: req.params.id },
      data: { status: parsed.data.status },
      include: { items: true, customer: true },
    });
    if (parsed.data.status === "delivered") {
      await creditWalletCashback(order.id);
    } else if (parsed.data.status === "cancelled") {
      await reverseWalletCashback(order.id);
    }
    res.json(order);
  }),
);

adminOrdersRouter.delete(
  "/bulk",
  asyncHandler(async (req, res) => {
    const parsed = bulkDeleteSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "شناسه‌های نامعتبر" });
      return;
    }
    await prisma.order.deleteMany({ where: { id: { in: parsed.data.ids } } });
    res.status(204).end();
  }),
);
