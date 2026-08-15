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
