import type { NextFunction, Request, Response } from "express";
import { CUSTOMER_COOKIE_NAME, verifyCustomerToken, type CustomerTokenPayload } from "../lib/auth.js";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      customer?: CustomerTokenPayload;
    }
  }
}

export function requireCustomerAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.[CUSTOMER_COOKIE_NAME];
  if (!token) {
    res.status(401).json({ error: "ورود الزامی است" });
    return;
  }
  try {
    req.customer = verifyCustomerToken(token);
    next();
  } catch {
    res.status(401).json({ error: "نشست کاربری نامعتبر است" });
  }
}
