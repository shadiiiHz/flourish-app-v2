const TEHRAN_TIME_ZONE = "Asia/Tehran";

interface DateParts {
  year: number;
  month: number;
  day: number;
}

function getTehranDateParts(date: Date): DateParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TEHRAN_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return { year: get("year"), month: get("month"), day: get("day") };
}

/** A Date at UTC midnight for the given Tehran calendar date — used only as a day-granularity marker, never as a real instant. */
function tehranCalendarMarker(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day));
}

/** Integer number of Tehran calendar days from a's date to b's date (b - a), ignoring time of day. */
export function tehranCalendarDayDiff(a: Date, b: Date): number {
  const pa = getTehranDateParts(a);
  const pb = getTehranDateParts(b);
  const ua = tehranCalendarMarker(pa.year, pa.month, pa.day).getTime();
  const ub = tehranCalendarMarker(pb.year, pb.month, pb.day).getTime();
  return Math.round((ub - ua) / 86400000);
}

/**
 * The next occurrence (this year, or next if it already passed) of
 * `monthDay`'s month/day, on or after `now`, in Tehran calendar terms —
 * e.g. for a birthday of Sep 21, called on Sep 19 returns this year's Sep
 * 21; called on Sep 22 returns next year's.
 */
export function nextTehranMonthDayOccurrence(monthDay: Date, now: Date): Date {
  const { month, day } = getTehranDateParts(monthDay);
  const { year: nowYear } = getTehranDateParts(now);
  const thisYear = tehranCalendarMarker(nowYear, month, day);
  if (tehranCalendarDayDiff(now, thisYear) < 0) {
    return tehranCalendarMarker(nowYear + 1, month, day);
  }
  return thisYear;
}

function getTehranOffsetMinutes(date: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TEHRAN_TIME_ZONE,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour") % 24, get("minute"), get("second"));
  return Math.round((asUtc - date.getTime()) / 60000);
}

/** The real instant of 23:59:59.999 Tehran wall-clock time, on the same Tehran calendar date as `date`. */
export function tehranEndOfDay(date: Date): Date {
  const { year, month, day } = getTehranDateParts(date);
  const approx = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));
  const offsetMinutes = getTehranOffsetMinutes(approx);
  return new Date(approx.getTime() - offsetMinutes * 60000);
}
