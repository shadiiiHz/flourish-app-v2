const OTP_TTL_MS = 5 * 60 * 1000;

interface OtpEntry<T> {
  code: string;
  data: T;
  expiresAt: number;
}

/**
 * Simple in-memory, single-process OTP store (no real SMS provider is wired
 * up yet — see AuthContext's original comment). Good enough for the demo
 * flow; swap for a persisted/shared store if the API ever runs multi-instance.
 */
class OtpStore<T = undefined> {
  private entries = new Map<string, OtpEntry<T>>();

  generate(key: string, data: T): string {
    const code = String(Math.floor(10000 + Math.random() * 90000));
    this.entries.set(key, { code, data, expiresAt: Date.now() + OTP_TTL_MS });
    return code;
  }

  verify(key: string, code: string): T | null {
    const entry = this.entries.get(key);
    if (!entry || entry.expiresAt < Date.now() || entry.code !== code) return null;
    this.entries.delete(key);
    return entry.data;
  }
}

export const loginOtpStore = new OtpStore<undefined>();
export const passwordChangeOtpStore = new OtpStore<{ passwordHash: string }>();
