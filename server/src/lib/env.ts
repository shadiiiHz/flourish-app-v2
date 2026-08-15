import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

export const env = {
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: required("DATABASE_URL"),
  jwtSecret: required("JWT_SECRET"),
  corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:5173",
  adminSeedEmail: process.env.ADMIN_SEED_EMAIL,
  adminSeedPassword: process.env.ADMIN_SEED_PASSWORD,
  adminSeedName: process.env.ADMIN_SEED_NAME ?? "مدیر فلوریش",
  melipayamakApiKey: process.env.MELIPAYAMAK_API_KEY,
  melipayamakOtpBodyId: process.env.MELIPAYAMAK_OTP_BODY_ID,
  zarinpalMerchantId: process.env.ZARINPAL_MERCHANT_ID,
  zarinpalSandbox: process.env.ZARINPAL_SANDBOX === "true",
  apiUrl: process.env.API_URL ?? `http://localhost:${Number(process.env.PORT ?? 4000)}`,
  appUrl: process.env.APP_URL ?? process.env.CORS_ORIGIN ?? "http://localhost:5173",
  storeLat: Number(process.env.STORE_LAT ?? 36.6549149),
  storeLng: Number(process.env.STORE_LNG ?? 51.4902702),
};
