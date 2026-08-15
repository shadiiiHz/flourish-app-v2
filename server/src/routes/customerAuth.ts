import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { CUSTOMER_COOKIE_NAME, signCustomerToken } from "../lib/auth.js";
import { env } from "../lib/env.js";
import { loginOtpStore, passwordChangeOtpStore } from "../lib/otpStore.js";
import { requireCustomerAuth } from "../middleware/requireCustomerAuth.js";
import { sendSms } from "../lib/sms.js";
import { asyncHandler } from "../lib/asyncHandler.js";

export const customerAuthRouter = Router();

/**
 * Sends the OTP over SMS when MELIPAYAMAK_API_KEY is configured; otherwise
 * falls back to logging + returning the code in the response, same as the
 * old fully-simulated demo flow (useful for local dev without SMS credit).
 */
async function deliverOtp(phone: string, code: string, message: string): Promise<{ code?: string }> {
  if (!env.melipayamakApiKey) {
    console.info(`[Flourish] کد شبیه‌سازی‌شده برای ${phone}: ${code}`);
    return { code };
  }
  await sendSms(phone, message);
  return {};
}

const isProduction = process.env.NODE_ENV === "production";

const cookieOptions = {
  httpOnly: true as const,
  sameSite: (isProduction ? "none" : "lax") as "none" | "lax",
  secure: isProduction,
  maxAge: 30 * 24 * 60 * 60 * 1000,
  path: "/",
};

function toAuthUser(customer: {
  phone: string;
  passwordHash: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  avatar: string | null;
}) {
  return {
    phone: customer.phone,
    hasPassword: !!customer.passwordHash,
    firstName: customer.firstName ?? undefined,
    lastName: customer.lastName ?? undefined,
    email: customer.email ?? undefined,
    avatar: customer.avatar ?? undefined,
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
    res.cookie(CUSTOMER_COOKIE_NAME, token, cookieOptions);
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
    res.cookie(CUSTOMER_COOKIE_NAME, token, cookieOptions);
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

customerAuthRouter.post("/logout", (_req, res) => {
  res.clearCookie(CUSTOMER_COOKIE_NAME, { path: "/" });
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
