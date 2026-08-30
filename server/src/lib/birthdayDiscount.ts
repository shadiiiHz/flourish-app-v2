import { prisma } from "./prisma.js";
import { generateBirthdayDiscountCode } from "./discountCodes.js";
import { isSameTehranCalendarDate, isSameTehranMonthDay } from "./tehranDate.js";
import { env } from "./env.js";
import { sendPatternSms } from "./sms.js";

const MAX_GENERATION_ATTEMPTS = 10;

/**
 * Texts the customer their new birthday discount code — best-effort, same as
 * notifyAdminOfNewOrder in orders.ts: a MeliPayamak failure (no credit,
 * rejected number, unset body id) must never fail the code-creation request.
 * {0} in the approved template is the customer's first name (falling back to
 * "مشتری" when they haven't set one), {1} is the code.
 */
async function notifyCustomerOfBirthdayDiscount(customerId: string, code: string): Promise<void> {
  if (!env.melipayamakBirthdayBodyId) return;
  const customer = await prisma.customer.findUnique({ where: { id: customerId } });
  if (!customer) return;
  const name = customer.firstName?.trim() || "مشتری";
  try {
    await sendPatternSms(customer.phone, env.melipayamakBirthdayBodyId, [name, code]);
  } catch (err) {
    console.error("Failed to send birthday discount SMS:", err);
  }
}

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
 * notification about it — once per birthday, not once per check. Does not
 * create a discount code; the admin picks the percent and creates it
 * themselves from the message (see createBirthdayDiscountCode).
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

/** Runs ensureBirthdayMessage for every customer who has a birthDate on file. */
async function checkAllCustomerBirthdays(): Promise<void> {
  const customers = await prisma.customer.findMany({
    where: { birthDate: { not: null } },
    select: { id: true, birthDate: true },
  });
  for (const customer of customers) {
    await ensureBirthdayMessage(customer.id, customer.birthDate);
  }
}

const BIRTHDAY_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;

/**
 * Starts the daily background sweep that notifies the admin of every
 * customer whose birthday is today, independent of whether that customer
 * ever opens the app. This app has no external task scheduler, so a plain
 * interval on the running Node process stands in for a cron job — call this
 * once, from the server entrypoint, after it starts listening.
 */
export function startBirthdayCheckCron(): void {
  const check = () => {
    checkAllCustomerBirthdays().catch((err) => {
      console.error("Failed to check customer birthdays:", err);
    });
  };
  check();
  setInterval(check, BIRTHDAY_CHECK_INTERVAL_MS);
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

  await notifyCustomerOfBirthdayDiscount(customerId, created.code);

  return created;
}
