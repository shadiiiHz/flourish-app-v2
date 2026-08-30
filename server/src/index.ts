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
import { startWalletCashbackExpiryCron } from "./lib/wallet.js";

const app = express();

// Runs behind the nginx reverse proxy; trust its X-Forwarded-Proto so
// req.secure reflects the browser's actual HTTP/HTTPS connection.
app.set("trust proxy", 1);

app.use(cors({ origin: env.corsOrigin, credentials: true }));
app.use(cookieParser());
app.use(express.json({ limit: "8mb" }));
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
  if (err && typeof err === "object" && "status" in err && err.status === 413) {
    res.status(413).json({ error: "حجم فایل ارسالی بیش از حد مجاز است" });
    return;
  }
  res.status(500).json({ error: "خطای غیرمنتظره سرور" });
});

app.listen(env.port, () => {
  console.log(`Flourish API listening on http://localhost:${env.port}`);
  startWalletCashbackExpiryCron();
});