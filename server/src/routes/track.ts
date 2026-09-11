import { randomUUID } from "node:crypto";
import { Router, type Request } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { asyncHandler } from "../lib/asyncHandler.js";

export const trackRouter = Router();

const VISITOR_COOKIE_NAME = "flourish_visitor_id";

// Same secure/sameSite reasoning as the customer auth cookie (see
// customerAuth.ts) — derived from the request rather than NODE_ENV since this
// is served same-origin behind one reverse proxy. Long-lived so a returning
// visitor keeps the same id across sessions.
function getVisitorCookieOptions(req: Request) {
  return {
    httpOnly: true as const,
    sameSite: "lax" as const,
    secure: req.secure,
    maxAge: 365 * 24 * 60 * 60 * 1000,
    path: "/",
  };
}

const trackVisitSchema = z.object({
  path: z.string().max(500).optional(),
});

/**
 * Fire-and-forget page-view beacon called once per storefront page load (see
 * VisitTracker.tsx). No auth — anyone can hit this, same as any other public
 * page — identifies repeat visits via a long-lived anonymous cookie rather
 * than anything personally identifying.
 */
trackRouter.post(
  "/visit",
  asyncHandler(async (req, res) => {
    const parsed = trackVisitSchema.safeParse(req.body);
    const path = parsed.success ? parsed.data.path : undefined;

    let visitorId: string | undefined = req.cookies?.[VISITOR_COOKIE_NAME];
    if (!visitorId) {
      visitorId = randomUUID();
      res.cookie(VISITOR_COOKIE_NAME, visitorId, getVisitorCookieOptions(req));
    }

    await prisma.pageVisit.create({ data: { visitorId, path } });
    res.status(204).end();
  }),
);
