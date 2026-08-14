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
