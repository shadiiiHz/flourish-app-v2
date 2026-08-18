import { Router } from "express";
import { requireAdminAuth } from "../../middleware/requireAdminAuth.js";
import { adminCategoriesRouter } from "./categories.js";
import { adminProductsRouter } from "./products.js";
import { adminOrdersRouter } from "./orders.js";
import { adminCustomersRouter } from "./customers.js";
import { adminUploadsRouter } from "./uploads.js";
import { adminSettingsRouter } from "./settings.js";
import { adminDiscountCodesRouter } from "./discountCodes.js";
import { adminWalletRouter } from "./wallet.js";

export const adminRouter = Router();

adminRouter.use(requireAdminAuth);
adminRouter.use("/categories", adminCategoriesRouter);
adminRouter.use("/products", adminProductsRouter);
adminRouter.use("/orders", adminOrdersRouter);
adminRouter.use("/customers", adminCustomersRouter);
adminRouter.use("/uploads", adminUploadsRouter);
adminRouter.use("/settings", adminSettingsRouter);
adminRouter.use("/discount-codes", adminDiscountCodesRouter);
adminRouter.use("/wallet", adminWalletRouter);
