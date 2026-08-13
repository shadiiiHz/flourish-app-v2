import type { NextFunction, Request, Response } from "express";
import { ADMIN_COOKIE_NAME, verifyAdminToken, type AdminTokenPayload } from "../lib/auth.js";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      admin?: AdminTokenPayload;
    }
  }
}

export function requireAdminAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.[ADMIN_COOKIE_NAME];
  if (!token) {
    res.status(401).json({ error: "ورود ادمین الزامی است" });
    return;
  }
  try {
    req.admin = verifyAdminToken(token);
    next();
  } catch {
    res.status(401).json({ error: "نشست ادمین نامعتبر است" });
  }
}
