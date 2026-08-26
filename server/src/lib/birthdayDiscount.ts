import { prisma } from "./prisma.js";
import { generateBirthdayDiscountCode } from "./discountCodes.js";
import { isSameTehranCalendarDate, isSameTehranMonthDay } from "./tehranDate.js";

const MAX_GENERATION_ATTEMPTS = 10;

/**
 * Read-only lookup for the customer's own profile page: is there already a
 * birthday discount code generated for today, and is it still unused?
 * Generation itself is a separate, admin-triggered step (see
 * createBirthdayDiscountCode) — this never creates one.
 */
export async function getActiveBirthdayDiscount(
  customerId: string,
): Promise<{ code: string; percent: number } | null> {
  const existing = await prisma.discountCode.findFirst({
    where: { customerId, source: "birthday" },
    orderBy: { createdAt: "desc" },
  });
  if (!existing || !existing.validOnDate) return null;
  if (!isSameTehranCalendarDate(existing.validOnDate, new Date())) return null;
  return existing.usedAt ? null : { code: existing.code, percent: existing.percent };
}

/**
 * On the customer's birthday (Tehran calendar), makes sure the admin has a
 * notification about it — once per birthday, not once per page load. Called
 * from GET /api/customers/auth/me so it fires without needing a cron job.
 * Does not create a discount code; the admin picks the percent and creates
 * it themselves from the message (see createBirthdayDiscountCode).
 */
export async function ensureBirthdayMessage(
  customerId: string,
  birthDate: Date | null,
): Promise<void> {
  if (!birthDate) return;
  const now = new Date();
  if (!isSameTehranMonthDay(birthDate, now)) return;

  const existing = await prisma.adminMessage.findFirst({
    where: { customerId, type: "birthday" },
    orderBy: { createdAt: "desc" },
  });
  if (existing && isSameTehranCalendarDate(existing.createdAt, now)) return;

  const customer = await prisma.customer.findUnique({ where: { id: customerId } });
  if (!customer) return;
  const name = [customer.firstName, customer.lastName].filter(Boolean).join(" ") || customer.phone;

  await prisma.adminMessage.create({
    data: {
      type: "birthday",
      customerId,
      title: "تولد مشتری 🎂",
      body: `امروز تولد ${name} است. یک کد تخفیف تولد براش ایجاد کن.`,
    },
  });
}

/**
 * Admin-triggered: creates the customer's personal, single-use, today-only
 * birthday discount code at the percent the admin chose, and marks the
 * triggering message as actioned (and read).
 */
export async function createBirthdayDiscountCode(
  customerId: string,
  percent: number,
  messageId?: string,
): Promise<{ id: string; code: string; percent: number }> {
  let created: { id: string; code: string; percent: number } | null = null;
  for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt++) {
    const code = generateBirthdayDiscountCode();
    try {
      created = await prisma.discountCode.create({
        data: {
          code,
          percent,
          customerId,
          validOnDate: new Date(),
          source: "birthday",
        },
      });
      break;
    } catch (err) {
      if (attempt === MAX_GENERATION_ATTEMPTS - 1) throw err;
    }
  }
  if (!created) throw new Error("امکان تولید کد تخفیف یکتا وجود نداشت");

  if (messageId) {
    await prisma.adminMessage.update({
      where: { id: messageId },
      data: { actionedAt: new Date(), isRead: true },
    });
  }

  return created;
}
