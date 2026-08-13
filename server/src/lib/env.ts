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
};
