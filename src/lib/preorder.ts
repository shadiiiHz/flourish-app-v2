export const MAX_PREORDER_DAYS_AHEAD = 10;

/** Preorder days only start opening up 2 days after today. */
export const MIN_PREORDER_DAYS_AHEAD = 2;

/** Business hours the pre-order time-slot grid is generated across. */
const SLOT_START_HOUR = 9;
const SLOT_END_HOUR = 21;

/** Persian calendar + month/weekday names, but Western (Latin) digits — matches the reference design. */
const FA_LATIN_DIGITS_LOCALE = "fa-IR-u-nu-latn";

function toIsoDate(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

export interface PreorderDateOption {
  iso: string;
  label: string;
  day: string;
  month: string;
}

/** The next MAX_PREORDER_DAYS_AHEAD days, starting MIN_PREORDER_DAYS_AHEAD days from today, for the date-picker carousel. */
export function generatePreorderDateOptions(): PreorderDateOption[] {
  const today = startOfToday();
  return Array.from({ length: MAX_PREORDER_DAYS_AHEAD }, (_, i) => {
    const date = new Date(today);
    date.setDate(date.getDate() + MIN_PREORDER_DAYS_AHEAD + i);
    const label = date.toLocaleDateString(FA_LATIN_DIGITS_LOCALE, { weekday: "long" });
    return {
      iso: toIsoDate(date),
      label,
      day: date.toLocaleDateString(FA_LATIN_DIGITS_LOCALE, { day: "numeric" }),
      month: date.toLocaleDateString(FA_LATIN_DIGITS_LOCALE, { month: "long" }),
    };
  });
}

/** Half-hour delivery windows across business hours, e.g. "09:00 - 09:30". */
export function generatePreorderTimeSlots(): string[] {
  const slots: string[] = [];
  for (let hour = SLOT_START_HOUR; hour < SLOT_END_HOUR; hour++) {
    for (const minute of [0, 30]) {
      const startH = String(hour).padStart(2, "0");
      const startM = String(minute).padStart(2, "0");
      const endHour = minute === 30 ? hour + 1 : hour;
      const endMinute = minute === 30 ? 0 : 30;
      const endH = String(endHour).padStart(2, "0");
      const endM = String(endMinute).padStart(2, "0");
      slots.push(`${startH}:${startM} - ${endH}:${endM}`);
    }
  }
  return slots;
}

function parseIsoDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** e.g. "28 مرداد 1405" — used in the checkout summary card. */
export function formatPreorderDateLong(iso: string): string {
  return parseIsoDate(iso).toLocaleDateString(FA_LATIN_DIGITS_LOCALE, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** e.g. "یکشنبه 25 مرداد" — used in the persistent site-wide banner. */
export function formatPreorderDateWithWeekday(iso: string): string {
  return parseIsoDate(iso).toLocaleDateString(FA_LATIN_DIGITS_LOCALE, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

export function isoToday(): string {
  return toIsoDate(startOfToday());
}
