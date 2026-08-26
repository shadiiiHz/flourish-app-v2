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

/** Whether both dates fall on the same calendar day in Tehran time. */
export function isSameTehranCalendarDate(a: Date, b: Date): boolean {
  const pa = getTehranDateParts(a);
  const pb = getTehranDateParts(b);
  return pa.year === pb.year && pa.month === pb.month && pa.day === pb.day;
}

/** Whether both dates share the same month and day in Tehran time, ignoring year — for birthday matching. */
export function isSameTehranMonthDay(a: Date, b: Date): boolean {
  const pa = getTehranDateParts(a);
  const pb = getTehranDateParts(b);
  return pa.month === pb.month && pa.day === pb.day;
}
