/** Persian weekday names indexed by JS getDay() numbering (0=Sunday … 6=Saturday). */
const WEEKDAY_NAMES_FA = ["یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه", "شنبه"];

/**
 * Whether a product can be preordered for the given scheduled date.
 * `scheduledDate` is the UTC-midnight marker parsed from the customer's
 * "YYYY-MM-DD", so its UTC weekday is the calendar weekday they picked.
 * An empty `preorderWeekdays` means the product is preorderable every day.
 */
export function isPreorderableOnDate(preorderWeekdays: number[], scheduledDate: Date): boolean {
  return preorderWeekdays.length === 0 || preorderWeekdays.includes(scheduledDate.getUTCDay());
}

export function weekdayNameFa(date: Date): string {
  return WEEKDAY_NAMES_FA[date.getUTCDay()];
}
