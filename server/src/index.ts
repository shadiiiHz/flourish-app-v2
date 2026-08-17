import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import path from "node:path";
import { env } from "./lib/env.js";
import { adminAuthRouter } from "./routes/adminAuth.js";
import { adminRouter } from "./routes/admin/index.js";
import { catalogRouter } from "./routes/catalog.js";
import { customerAuthRouter } from "./routes/customerAuth.js";
import { customersRouter } from "./routes/customers.js";
import { ordersRouter } from "./routes/orders.js";
import { shippingRouter } from "./routes/shipping.js";
import { discountCodesRouter } from "./routes/discountCodes.js";

const app = express();

app.use(cors({ origin: env.corsOrigin, credentials: true }));
app.use(cookieParser());
app.use(express.json());
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

app.get("/health", (_req, res) => res.json({ ok: true }));

app.use("/api", catalogRouter);
app.use("/api/customers/auth", customerAuthRouter);
app.use("/api/customers", customersRouter);
app.use("/api/orders", ordersRouter);
app.use("/api/shipping", shippingRouter);
app.use("/api/discount-codes", discountCodesRouter);
app.use("/api/admin/auth", adminAuthRouter);
app.use("/api/admin", adminRouter);

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "خطای غیرمنتظره سرور" });
});

app.listen(env.port, () => {
  console.log(`Flourish API listening on http://localhost:${env.port}`);
});
