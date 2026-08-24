const ORDER_NUMBER_PREFIX = "FL";
const ORDER_NUMBER_PAD = 6;

/** Formats the DB's unique auto-increment orderNumber as a standard "FL-000123" order number. */
export function formatOrderNumber(orderNumber: number): string {
  return `${ORDER_NUMBER_PREFIX}-${String(orderNumber).padStart(ORDER_NUMBER_PAD, "0")}`;
}
