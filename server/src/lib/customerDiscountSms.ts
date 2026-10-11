import { env } from "./env.js";
import { sendPatternSms } from "./sms.js";
import { getTehranDateParts } from "./tehranDate.js";
import { gregorianToJalali } from "./jalali.js";

const PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹";

/** The Jalali (Tehran) calendar date of `date` as "۱۴۰۵/۰۷/۲۵". */
function formatJalaliDate(date: Date): string {
  const { year, month, day } = getTehranDateParts(date);
  const { jy, jm, jd } = gregorianToJalali(year, month, day);
  const text = `${jy}/${String(jm).padStart(2, "0")}/${String(jd).padStart(2, "0")}`;
  return text.replace(/\d/g, (d) => PERSIAN_DIGITS[Number(d)]);
}

/**
 * Texts a customer the personal discount code an admin just created for them
 * — best-effort, like the other MeliPayamak notifications: a delivery failure
 * (no credit, rejected number, unset body id) must never fail code creation.
 * Returns whether the SMS was actually sent, so the admin panel can say so.
 * In the approved template {0} is the customer's first name (falling back to
 * "مشتری"), {1} is the code and {2} is the Jalali date it is valid until.
 */
export async function notifyCustomerOfDiscountCode(
  customer: { phone: string; firstName: string | null },
  code: string,
  expiresAt: Date,
): Promise<boolean> {
  if (!env.melipayamakCustomerDiscountBodyId) return false;
  const name = customer.firstName?.trim() || "مشتری";
  try {
    await sendPatternSms(customer.phone, env.melipayamakCustomerDiscountBodyId, [
      name,
      code,
      formatJalaliDate(expiresAt),
    ]);
    return true;
  } catch (err) {
    console.error("Failed to send customer discount SMS:", err);
    return false;
  }
}
