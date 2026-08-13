import jwt from "jsonwebtoken";
import { env } from "./env.js";

export interface AdminTokenPayload {
  sub: string;
  email: string;
  role: string;
}

export const ADMIN_COOKIE_NAME = "flourish_admin_token";

export function signAdminToken(payload: AdminTokenPayload): string {
  return jwt.sign(payload, env.jwtSecret, { expiresIn: "7d" });
}

export function verifyAdminToken(token: string): AdminTokenPayload {
  return jwt.verify(token, env.jwtSecret) as AdminTokenPayload;
}

export interface CustomerTokenPayload {
  sub: string;
  phone: string;
  type: "customer";
}

export const CUSTOMER_COOKIE_NAME = "flourish_customer_token";

export function signCustomerToken(payload: Omit<CustomerTokenPayload, "type">): string {
  return jwt.sign({ ...payload, type: "customer" }, env.jwtSecret, { expiresIn: "30d" });
}

export function verifyCustomerToken(token: string): CustomerTokenPayload {
  const payload = jwt.verify(token, env.jwtSecret) as CustomerTokenPayload;
  if (payload.type !== "customer") throw new Error("invalid token type");
  return payload;
}
