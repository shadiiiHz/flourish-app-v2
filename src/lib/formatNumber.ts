/** Strips everything but digits — used to read back a raw value from a comma-formatted input. */
export function digitsOnly(value: string) {
  return value.replace(/[^\d]/g, "");
}

/** Formats a raw digit string with thousands separators for display in a price input. */
export function formatThousands(value: string) {
  const digits = digitsOnly(value);
  if (!digits) return "";
  return Number(digits).toLocaleString("en-US");
}

const PERSIAN_DIGITS = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];

/**
 * Converts any Western digits (0-9) inside a free-text string to Persian
 * digits, for storefront display of admin-entered text like "500 گرم" or
 * "1.5 کیلوگرم". A "." directly between two digits is a decimal point, so
 * it's swapped for "٫" (the Arabic decimal separator, U+066B) — the correct
 * Persian typographic convention — before the digits themselves are
 * converted; any other "." (e.g. plain sentence punctuation) is left as-is.
 * Everything else in the string is untouched.
 */
export function toPersianDigits(value: string) {
  const withPersianDecimal = value.replace(/(\d)\.(\d)/g, "$1٫$2");
  return withPersianDecimal.replace(/\d/g, (digit) => PERSIAN_DIGITS[Number(digit)]);
}
