import { env } from "./env.js";

/**
 * Sends an SMS via MeliPayamak's console REST API
 * (https://console.melipayamak.com/api/send/simple/{apikey}).
 * Only called when MELIPAYAMAK_API_KEY is configured — see customerAuth.ts
 * for the dev-mode fallback used when it isn't.
 */
export async function sendSms(to: string, text: string): Promise<void> {
  const res = await fetch(
    `https://console.melipayamak.com/api/send/simple/${env.melipayamakApiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ from: env.melipayamakSender, to, text }),
    },
  );
  const body = await res.text();

  if (!res.ok) {
    console.error(`MeliPayamak request failed for ${to}: HTTP ${res.status} — ${body}`);
    throw new Error(`MeliPayamak request failed with status ${res.status}`);
  }

  // MeliPayamak's "simple send" API returns HTTP 200 even on failure — the
  // actual result is a numeric message id (success) or a negative error
  // code (e.g. invalid number, insufficient credit, unapproved sender) in
  // the body. Log it either way so a silent per-number failure is visible.
  const resultCode = Number(body.trim().replace(/^"|"$/g, ""));
  if (Number.isFinite(resultCode) && resultCode < 0) {
    console.error(`MeliPayamak rejected SMS to ${to}: code ${resultCode} — ${body}`);
    throw new Error(`MeliPayamak rejected the SMS (code ${resultCode})`);
  }

  console.info(`MeliPayamak SMS to ${to}: ${body}`);
}

interface PatternSmsResponse {
  Value?: string;
  RetStatus?: number;
  StrRetStatus?: string;
}

/**
 * Sends an SMS via the "خط خدماتی اشتراکی" (shared service line) REST API
 * (https://rest.payamak-panel.com/api/SendSMS/BaseServiceNumber), using a
 * pre-approved template (bodyId) with placeholder values, instead of a
 * dedicated sender line + free text like sendSms above.
 *
 * This is a different MeliPayamak product from sendSms's console API —
 * auth is username + password (the account's ApiKey goes in the password
 * field per MeliPayamak's docs), and placeholder values are joined with
 * ";" into a single text field rather than a JSON array.
 */
export async function sendPatternSms(
  to: string,
  bodyId: number,
  args: string[],
): Promise<void> {
  const res = await fetch("https://rest.payamak-panel.com/api/SendSMS/BaseServiceNumber", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: env.melipayamakUsername,
      password: env.melipayamakApiKey,
      text: args.join(";"),
      to,
      bodyId,
    }),
  });
  const data = (await res.json()) as PatternSmsResponse;

  if (!res.ok || data.RetStatus !== 1) {
    console.error(`MeliPayamak pattern SMS failed for ${to}: HTTP ${res.status} — ${JSON.stringify(data)}`);
    throw new Error(
      data.StrRetStatus && data.StrRetStatus !== "InvalidData"
        ? data.StrRetStatus
        : `MeliPayamak pattern SMS rejected (code ${data.Value})`,
    );
  }

  console.info(`MeliPayamak pattern SMS to ${to}: recId ${data.Value}`);
}
