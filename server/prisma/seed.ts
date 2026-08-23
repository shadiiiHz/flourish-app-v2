import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Catalog seeding (categories/products) has been removed on purpose: the database is
 * now the single source of truth, managed entirely from the admin panel. This only
 * makes sure an admin login exists — safe to re-run since it upserts by email.
 */
async function main() {
  const adminEmail = process.env.ADMIN_SEED_EMAIL;
  const adminPassword = process.env.ADMIN_SEED_PASSWORD;
  if (adminEmail && adminPassword) {
    const passwordHash = await bcrypt.hash(adminPassword, 12);
    await prisma.adminUser.upsert({
      where: { email: adminEmail },
      update: {},
      create: {
        email: adminEmail,
        passwordHash,
        name: process.env.ADMIN_SEED_NAME ?? "مدیر فلوریش",
        role: "owner",
      },
    });
    console.log(`Seeded admin user: ${adminEmail}`);
  } else {
    console.warn("ADMIN_SEED_EMAIL/ADMIN_SEED_PASSWORD not set — skipping admin user seed.");
  }

  console.log("Seed complete.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
