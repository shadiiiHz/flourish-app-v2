import { Router, type Request } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { CUSTOMER_COOKIE_NAME, signCustomerToken } from "../lib/auth.js";
import { env } from "../lib/env.js";
import { loginOtpStore, passwordChangeOtpStore } from "../lib/otpStore.js";
import { requireCustomerAuth } from "../middleware/requireCustomerAuth.js";
import { sendSms, sendPatternSms } from "../lib/sms.js";
import { asyncHandler } from "../lib/asyncHandler.js";

export const customerAuthRouter = Router();

/**
 * Sends the OTP over SMS when MELIPAYAMAK_API_KEY is configured; otherwise
 * falls back to logging + returning the code in the response, same as the
 * old fully-simulated demo flow (useful for local dev without SMS credit).
 *
 * When MELIPAYAMAK_OTP_BODY_ID is also set, delivery goes through the
 * shared-line pattern API (a pre-approved template with the code as its
 * only placeholder) instead of a free-text send on a dedicated line.
 */
async function deliverOtp(phone: string, code: string, message: string): Promise<{ code?: string }> {
  if (!env.melipayamakApiKey) {
    console.info(`[Flourish] کد شبیه‌سازی‌شده برای ${phone}: ${code}`);
    return { code };
  }
  if (env.melipayamakOtpBodyId) {
    await sendPatternSms(phone, env.melipayamakOtpBodyId, [code]);
    return {};
  }
  await sendSms(phone, message);
  return {};
}

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
    maxAge: 30 * 24 * 60 * 60 * 1000,
    path: "/",
  };
}

function toAuthUser(customer: {
  phone: string;
  passwordHash: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  avatar: string | null;
  walletBalance: number;
}) {
  return {
    phone: customer.phone,
    hasPassword: !!customer.passwordHash,
    firstName: customer.firstName ?? undefined,
    lastName: customer.lastName ?? undefined,
    email: customer.email ?? undefined,
    avatar: customer.avatar ?? undefined,
    walletBalance: customer.walletBalance,
  };
}

const phoneSchema = z.object({ phone: z.string().min(5) });

customerAuthRouter.post(
  "/otp/request",
  asyncHandler(async (req, res) => {
    const parsed = phoneSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "شماره موبایل معتبر نیست" });
      return;
    }
    const { phone } = parsed.data;
    const code = loginOtpStore.generate(phone, undefined);
    const result = await deliverOtp(phone, code, `کد ورود شما به فلوریش: ${code}`);
    res.json(result);
  }),
);

const verifyOtpSchema = z.object({ phone: z.string().min(5), code: z.string().min(1) });

customerAuthRouter.post(
  "/otp/verify",
  asyncHandler(async (req, res) => {
    const parsed = verifyOtpSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "اطلاعات معتبر نیست" });
      return;
    }
    const { phone, code } = parsed.data;
    if (loginOtpStore.verify(phone, code) === null) {
      res.status(401).json({ error: "کد وارد شده صحیح نیست" });
      return;
    }
    const customer = await prisma.customer.upsert({
      where: { phone },
      update: {},
      create: { phone },
    });
    const token = signCustomerToken({ sub: customer.id, phone: customer.phone });
    res.cookie(CUSTOMER_COOKIE_NAME, token, getCookieOptions(req));
    res.json(toAuthUser(customer));
  }),
);

const loginSchema = z.object({ phone: z.string().min(5), password: z.string().min(1) });

customerAuthRouter.post(
  "/login",
  asyncHandler(async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "اطلاعات معتبر نیست" });
      return;
    }
    const { phone, password } = parsed.data;
    const customer = await prisma.customer.findUnique({ where: { phone } });
    if (!customer?.passwordHash) {
      res.status(401).json({ error: "شماره موبایل یا کلمه عبور اشتباه است" });
      return;
    }
    const valid = await bcrypt.compare(password, customer.passwordHash);
    if (!valid) {
      res.status(401).json({ error: "شماره موبایل یا کلمه عبور اشتباه است" });
      return;
    }
    const token = signCustomerToken({ sub: customer.id, phone: customer.phone });
    res.cookie(CUSTOMER_COOKIE_NAME, token, getCookieOptions(req));
    res.json(toAuthUser(customer));
  }),
);

customerAuthRouter.get(
  "/me",
  requireCustomerAuth,
  asyncHandler(async (req, res) => {
    const customer = await prisma.customer.findUnique({ where: { id: req.customer!.sub } });
    if (!customer) {
      res.status(401).json({ error: "کاربر یافت نشد" });
      return;
    }
    res.json(toAuthUser(customer));
  }),
);

customerAuthRouter.post("/logout", (req, res) => {
  // clearCookie's Set-Cookie must match the sameSite/secure the cookie was
  // set with, or browsers silently ignore it and the session cookie never
  // actually clears — see getCookieOptions above.
  const { httpOnly, sameSite, secure, path } = getCookieOptions(req);
  res.clearCookie(CUSTOMER_COOKIE_NAME, { httpOnly, sameSite, secure, path });
  res.status(204).end();
});

const passwordChangeRequestSchema = z.object({ newPassword: z.string().min(1) });

customerAuthRouter.post(
  "/password/request",
  requireCustomerAuth,
  asyncHandler(async (req, res) => {
    const parsed = passwordChangeRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "کلمه عبور معتبر نیست" });
      return;
    }
    const passwordHash = await bcrypt.hash(parsed.data.newPassword, 12);
    const code = passwordChangeOtpStore.generate(req.customer!.sub, { passwordHash });
    const result = await deliverOtp(
      req.customer!.phone,
      code,
      `کد تایید تغییر رمز عبور فلوریش: ${code}`,
    );
    res.json(result);
  }),
);

const passwordChangeConfirmSchema = z.object({ code: z.string().min(1) });

customerAuthRouter.post(
  "/password/confirm",
  requireCustomerAuth,
  asyncHandler(async (req, res) => {
    const parsed = passwordChangeConfirmSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "کد معتبر نیست" });
      return;
    }
    const pending = passwordChangeOtpStore.verify(req.customer!.sub, parsed.data.code);
    if (!pending) {
      res.status(401).json({ error: "کد وارد شده صحیح نیست" });
      return;
    }
    const customer = await prisma.customer.update({
      where: { id: req.customer!.sub },
      data: { passwordHash: pending.passwordHash },
    });
    res.json(toAuthUser(customer));
  }),
);