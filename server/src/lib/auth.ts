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
