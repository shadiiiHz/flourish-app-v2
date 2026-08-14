import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { requireCustomerAuth } from "../middleware/requireCustomerAuth.js";
import { calculateShipping } from "../lib/shipping.js";

export const shippingRouter = Router();

shippingRouter.get(
  "/estimate",
  requireCustomerAuth,
  asyncHandler(async (req, res) => {
    const addressId = typeof req.query.addressId === "string" ? req.query.addressId : undefined;
    if (!addressId) {
      res.status(400).json({ error: "آدرس مشخص نشده است" });
      return;
    }
    const address = await prisma.address.findFirst({
      where: { id: addressId, customerId: req.customer!.sub },
    });
    if (!address) {
      res.status(404).json({ error: "آدرس یافت نشد" });
      return;
    }
    if (address.lat == null || address.lng == null) {
      res.status(400).json({ error: "موقعیت مکانی این آدرس ثبت نشده است" });
      return;
    }
    const estimate = await calculateShipping(address.lat, address.lng);
    res.json(estimate);
  }),
);
