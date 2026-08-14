import { env } from "./env.js";

/**
 * ZarinPal's payment API expects amounts in Rial; the rest of this app
 * (prices, order totals) is stored in Toman, so every amount is ×10 at
 * the boundary here.
 */
const RIAL_PER_TOMAN = 10;

const API_BASE = env.zarinpalSandbox
  ? "https://sandbox.zarinpal.com"
  : "https://api.zarinpal.com";
const GATEWAY_BASE = env.zarinpalSandbox
  ? "https://sandbox.zarinpal.com"
  : "https://www.zarinpal.com";

interface RequestPaymentParams {
  amountToman: number;
  description: string;
  callbackUrl: string;
  mobile?: string;
}

interface ZarinpalErrors {
  code?: number;
  message?: string;
  validations?: unknown;
}

interface ZarinpalRequestResponse {
  data?: { code?: number; authority?: string };
  errors?: ZarinpalErrors | unknown[];
}

interface ZarinpalVerifyResponse {
  data?: { code?: number; ref_id?: number | string };
  errors?: ZarinpalErrors | unknown[];
}

export async function requestZarinpalPayment(
  params: RequestPaymentParams,
): Promise<{ authority: string; payUrl: string }> {
  if (!env.zarinpalMerchantId) {
    throw new Error("درگاه پرداخت زرین‌پال تنظیم نشده است");
  }

  const res = await fetch(`${API_BASE}/pg/v4/payment/request.json`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      merchant_id: env.zarinpalMerchantId,
      amount: params.amountToman * RIAL_PER_TOMAN,
      description: params.description,
      callback_url: params.callbackUrl,
      metadata: params.mobile ? { mobile: params.mobile } : undefined,
    }),
  });
  const data = (await res.json()) as ZarinpalRequestResponse;
  const authority = data?.data?.authority;
  if (data?.data?.code !== 100 || !authority) {
    console.error("Zarinpal request.json rejected:", JSON.stringify(data));
    const errors = Array.isArray(data?.errors) ? undefined : (data?.errors as ZarinpalErrors | undefined);
    throw new Error(
      errors?.message ? `خطا در درگاه پرداخت: ${errors.message}` : "خطا در اتصال به درگاه پرداخت",
    );
  }

  return { authority, payUrl: `${GATEWAY_BASE}/pg/StartPay/${authority}` };
}

interface VerifyPaymentParams {
  amountToman: number;
  authority: string;
}

export async function verifyZarinpalPayment(
  params: VerifyPaymentParams,
): Promise<{ ok: boolean; refId?: string }> {
  if (!env.zarinpalMerchantId) {
    throw new Error("درگاه پرداخت زرین‌پال تنظیم نشده است");
  }

  const res = await fetch(`${API_BASE}/pg/v4/payment/verify.json`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      merchant_id: env.zarinpalMerchantId,
      amount: params.amountToman * RIAL_PER_TOMAN,
      authority: params.authority,
    }),
  });
  const data = (await res.json()) as ZarinpalVerifyResponse;
  const code = data?.data?.code;
  if (code === 100 || code === 101) {
    return { ok: true, refId: String(data.data?.ref_id) };
  }
  console.error("Zarinpal verify.json rejected:", JSON.stringify(data));
  return { ok: false };
}
