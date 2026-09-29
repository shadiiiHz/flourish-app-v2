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

/**
 * Weekdays in Iranian week order (Saturday first), keyed by JS getDay()
 * numbering (0=Sunday … 6=Saturday) — the same numbering stored in a
 * product's `preorderWeekdays`.
 */
export const PREORDER_WEEKDAYS: { value: number; label: string }[] = [
  { value: 6, label: "شنبه" },
  { value: 0, label: "یکشنبه" },
  { value: 1, label: "دوشنبه" },
  { value: 2, label: "سه‌شنبه" },
  { value: 3, label: "چهارشنبه" },
  { value: 4, label: "پنجشنبه" },
  { value: 5, label: "جمعه" },
];

/** «روزهای زوج»: Saturday, Monday, Wednesday. */
export const EVEN_WEEKDAYS = [6, 1, 3];
/** «روزهای فرد»: Sunday, Tuesday, Thursday. */
export const ODD_WEEKDAYS = [0, 2, 4];

export function weekdayOfIso(iso: string): number {
  return parseIsoDate(iso).getDay();
}

/** Whether a product with these allowed weekdays can be preordered for `iso`. Empty means every day. */
export function isPreorderableOn(preorderWeekdays: number[] | undefined, iso: string): boolean {
  return !preorderWeekdays || preorderWeekdays.length === 0 || preorderWeekdays.includes(weekdayOfIso(iso));
}

/** e.g. "شنبه، دوشنبه، چهارشنبه" in Iranian week order. */
export function formatPreorderWeekdays(preorderWeekdays: number[]): string {
  return PREORDER_WEEKDAYS.filter((d) => preorderWeekdays.includes(d.value))
    .map((d) => d.label)
    .join("، ");
}

/**
 * Whether an item can be preordered at all, and — once the customer has
 * picked a preorder date — whether it can be preordered for that date.
 */
export function isItemPreorderable(
  item: { allowPreorder: boolean; preorderWeekdays?: number[] },
  preorderDate?: string,
): boolean {
  if (!item.allowPreorder) return false;
  return !preorderDate || isPreorderableOn(item.preorderWeekdays, preorderDate);
}
