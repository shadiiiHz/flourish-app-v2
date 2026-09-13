import { env } from "./env.js";
import { sendPatternSms } from "./sms.js";

/**
 * Texts a new customer once, right after their first signup — either
 * self-service (OTP verify) or an admin creating them manually — never on a
 * later login. Best-effort, same as the other MeliPayamak notifications: a
 * delivery failure must never fail the signup itself.
 * {0} in the approved template is the customer's first name (falling back to
 * "مشتری" when they haven't set one).
 */
export async function notifyCustomerWelcome(customer: {
  phone: string;
  firstName: string | null;
}): Promise<void> {
  if (!env.melipayamakWelcomeBodyId) return;
  const name = customer.firstName?.trim() || "مشتری";
  try {
    await sendPatternSms(customer.phone, env.melipayamakWelcomeBodyId, [name]);
  } catch (err) {
    console.error("Failed to send welcome SMS:", err);
  }
}
