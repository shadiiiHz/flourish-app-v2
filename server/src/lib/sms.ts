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
  if (!res.ok) {
    throw new Error(`MeliPayamak request failed with status ${res.status}`);
  }
}
