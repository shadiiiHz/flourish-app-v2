import { env } from "./env.js";

interface MeliPayamakSharedResponse {
  recId?: number;
  status?: string;
}

/**
 * Sends the OTP code via MeliPayamak's pattern ("shared body") API
 * (https://console.melipayamak.com/api/send/shared/{apikey}), filling the
 * pre-approved template (MELIPAYAMAK_OTP_BODY_ID) with the code as its only
 * argument. Pattern-based sends are used instead of free-text SMS because
 * carriers are far more likely to filter/block plain-text OTP messages sent
 * from a shared line. Only called when MELIPAYAMAK_API_KEY is configured —
 * see customerAuth.ts for the dev-mode fallback used when it isn't.
 */
export async function sendOtpSms(to: string, code: string): Promise<void> {
  const res = await fetch(
    `https://console.melipayamak.com/api/send/shared/${env.melipayamakApiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bodyId: env.melipayamakOtpBodyId, to, args: [code] }),
    },
  );
  const body = await res.text();

  if (!res.ok) {
    console.error(`MeliPayamak OTP request failed for ${to}: HTTP ${res.status} — ${body}`);
    throw new Error(`MeliPayamak OTP request failed with status ${res.status}`);
  }

  let parsed: MeliPayamakSharedResponse;
  try {
    parsed = JSON.parse(body);
  } catch {
    console.error(`MeliPayamak OTP response for ${to} was not JSON: ${body}`);
    throw new Error("MeliPayamak returned an unexpected OTP response");
  }

  if (!parsed.recId) {
    console.error(`MeliPayamak rejected OTP SMS to ${to}: ${parsed.status ?? body}`);
    throw new Error(`MeliPayamak rejected the OTP SMS: ${parsed.status ?? "unknown error"}`);
  }

  console.info(`MeliPayamak OTP SMS to ${to}: recId ${parsed.recId}`);
}
