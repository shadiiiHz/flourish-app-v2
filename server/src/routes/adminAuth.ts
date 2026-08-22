import { Router, type Request } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { ADMIN_COOKIE_NAME, signAdminToken } from "../lib/auth.js";
import { requireAdminAuth } from "../middleware/requireAdminAuth.js";
import { asyncHandler } from "../lib/asyncHandler.js";

export const adminAuthRouter = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// secure/sameSite are derived from the actual request instead of NODE_ENV:
// the app is served same-origin behind a single reverse proxy, so "lax" is
// correct regardless of environment, and "secure" must match whether this
// particular request arrived over HTTPS (via req.secure, which honors
// X-Forwarded-Proto once "trust proxy" is set) — a cookie marked Secure is
// silently dropped by the browser over plain HTTP.
function getCookieOptions(req: Request) {
  return {
    httpOnly: true as const,
    sameSite: "lax" as const,
    secure: req.secure,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: "/",
  };
}

adminAuthRouter.post(
  "/login",
  asyncHandler(async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "ایمیل و رمز عبور را به‌درستی وارد کنید" });
      return;
    }
    const { email, password } = parsed.data;

    const admin = await prisma.adminUser.findUnique({ where: { email } });
    if (!admin) {
      res.status(401).json({ error: "ایمیل یا رمز عبور اشتباه است" });
      return;
    }

    const valid = await bcrypt.compare(password, admin.passwordHash);
    if (!valid) {
      res.status(401).json({ error: "ایمیل یا رمز عبور اشتباه است" });
      return;
    }

    const token = signAdminToken({ sub: admin.id, email: admin.email, role: admin.role });
    res.cookie(ADMIN_COOKIE_NAME, token, getCookieOptions(req));
    res.json({ id: admin.id, email: admin.email, name: admin.name, role: admin.role });
  }),
);

adminAuthRouter.post("/logout", (req, res) => {
  // clearCookie's Set-Cookie must match the sameSite/secure the cookie was
  // set with, or browsers silently ignore it and the session cookie never
  // actually clears — see getCookieOptions above.
  const { httpOnly, sameSite, secure, path } = getCookieOptions(req);
  res.clearCookie(ADMIN_COOKIE_NAME, { httpOnly, sameSite, secure, path });
  res.status(204).end();
});

adminAuthRouter.get(
  "/me",
  requireAdminAuth,
  asyncHandler(async (req, res) => {
    const admin = await prisma.adminUser.findUnique({ where: { id: req.admin!.sub } });
    if (!admin) {
      res.status(401).json({ error: "کاربر ادمین یافت نشد" });
      return;
    }
    res.json({ id: admin.id, email: admin.email, name: admin.name, role: admin.role });
  }),
);