import { Router } from "express";
import { prisma } from "../../lib/prisma.js";
import { asyncHandler } from "../../lib/asyncHandler.js";
import { getTehranDateParts } from "../../lib/tehranDate.js";

export const adminAnalyticsRouter = Router();

/** A visitor counts as "online now" if they've had a page view within this window. */
const LIVE_WINDOW_MINUTES = 5;
/** How far back the per-minute chart series goes. */
const CHART_WINDOW_MINUTES = 30;

/**
 * Live storefront traffic for the admin dashboard: how many distinct
 * visitors are "online now" (a page view within LIVE_WINDOW_MINUTES), plus a
 * per-minute series of visit/visitor counts for the last CHART_WINDOW_MINUTES
 * — meant to be polled every few seconds rather than pushed, since a normal
 * admin dashboard doesn't need true push-based real-time.
 */
adminAnalyticsRouter.get(
  "/live",
  asyncHandler(async (_req, res) => {
    const now = new Date();
    const liveWindowStart = new Date(now.getTime() - LIVE_WINDOW_MINUTES * 60_000);
    const chartWindowStart = new Date(now.getTime() - CHART_WINDOW_MINUTES * 60_000);

    const [liveVisitorRows, recentVisits] = await Promise.all([
      prisma.pageVisit.findMany({
        where: { createdAt: { gte: liveWindowStart } },
        select: { visitorId: true },
        distinct: ["visitorId"],
      }),
      prisma.pageVisit.findMany({
        where: { createdAt: { gte: chartWindowStart } },
        select: { visitorId: true, createdAt: true },
      }),
    ]);

    // One bucket per minute across the whole window, oldest first, so a
    // quiet minute still shows up as a zero-height bar instead of a gap.
    const buckets: { visits: number; visitors: Set<string> }[] = Array.from(
      { length: CHART_WINDOW_MINUTES },
      () => ({ visits: 0, visitors: new Set<string>() }),
    );
    for (const visit of recentVisits) {
      const minutesAgo = Math.floor((now.getTime() - visit.createdAt.getTime()) / 60_000);
      const index = CHART_WINDOW_MINUTES - 1 - minutesAgo;
      if (index < 0 || index >= CHART_WINDOW_MINUTES) continue;
      buckets[index].visits += 1;
      buckets[index].visitors.add(visit.visitorId);
    }

    res.json({
      liveVisitors: liveVisitorRows.length,
      series: buckets.map((bucket, index) => ({
        minutesAgo: CHART_WINDOW_MINUTES - 1 - index,
        visits: bucket.visits,
        visitors: bucket.visitors.size,
      })),
    });
  }),
);

const DEFAULT_DAILY_DAYS = 10;
const MAX_DAILY_DAYS = 60;

/** "YYYY-MM-DD" for the Tehran calendar day `date` falls on — a bucket key, not a real instant. */
function tehranDateKey(date: Date): string {
  const { year, month, day } = getTehranDateParts(date);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * Day-granularity visit/visitor history for the dashboard chart — defaults
 * to the last 10 Tehran-calendar days, oldest first, with today included.
 */
adminAnalyticsRouter.get(
  "/daily",
  asyncHandler(async (req, res) => {
    const requested = Number(req.query.days);
    const days = Number.isFinite(requested)
      ? Math.min(MAX_DAILY_DAYS, Math.max(1, Math.round(requested)))
      : DEFAULT_DAILY_DAYS;

    const now = new Date();
    const rangeStart = new Date(now.getTime() - (days - 1) * 24 * 60 * 60 * 1000);

    const visits = await prisma.pageVisit.findMany({
      where: { createdAt: { gte: rangeStart } },
      select: { visitorId: true, createdAt: true },
    });

    // One bucket per Tehran-calendar day across the whole window, oldest
    // first, so a quiet day still shows as a zero point instead of a gap.
    const dayKeys = Array.from({ length: days }, (_, i) =>
      tehranDateKey(new Date(now.getTime() - (days - 1 - i) * 24 * 60 * 60 * 1000)),
    );
    const buckets = new Map<string, { visits: number; visitors: Set<string> }>();
    for (const key of dayKeys) buckets.set(key, { visits: 0, visitors: new Set() });

    for (const visit of visits) {
      const bucket = buckets.get(tehranDateKey(visit.createdAt));
      if (!bucket) continue;
      bucket.visits += 1;
      bucket.visitors.add(visit.visitorId);
    }

    res.json({
      days: dayKeys.map((date) => {
        const bucket = buckets.get(date)!;
        return { date, visits: bucket.visits, visitors: bucket.visitors.size };
      }),
    });
  }),
);
