const TEHRAN_TIME_ZONE = "Asia/Tehran";

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function isValidTimeString(value: string): boolean {
  return TIME_PATTERN.test(value);
}

function parseTimeToMinutes(value: string): number {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function getCurrentTehranMinutes(now: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TEHRAN_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return hour * 60 + minute;
}

/**
 * Whether `now` falls in [start, end) Tehran time. Supports an overnight range
 * (e.g. 22:00-02:00) by wrapping past midnight when start > end.
 */
export function isWithinBusinessHours(start: string, end: string, now: Date = new Date()): boolean {
  const startMinutes = parseTimeToMinutes(start);
  const endMinutes = parseTimeToMinutes(end);
  const nowMinutes = getCurrentTehranMinutes(now);
  if (startMinutes === endMinutes) return true;
  if (startMinutes < endMinutes) {
    return nowMinutes >= startMinutes && nowMinutes < endMinutes;
  }
  return nowMinutes >= startMinutes || nowMinutes < endMinutes;
}

export interface SiteAvailabilitySettings {
  siteClosed: boolean;
  businessHoursEnabled: boolean;
  businessHoursStart: string;
  businessHoursEnd: string;
}

/** Combines the manual "close the site" toggle with the automatic business-hours window. */
export function isSiteOpen(settings: SiteAvailabilitySettings, now: Date = new Date()): boolean {
  if (settings.siteClosed) return false;
  if (settings.businessHoursEnabled && !isWithinBusinessHours(settings.businessHoursStart, settings.businessHoursEnd, now)) {
    return false;
  }
  return true;
}
