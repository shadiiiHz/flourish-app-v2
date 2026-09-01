import { prisma } from "./prisma.js";
import { generateBirthdayDiscountCode } from "./discountCodes.js";
import {
  nextTehranMonthDayOccurrence,
  tehranCalendarDayDiff,
  tehranEndOfDay,
} from "./tehranDate.js";
import { env } from "./env.js";
import { sendPatternSms } from "./sms.js";

const MAX_GENERATION_ATTEMPTS = 10;

/** Admin gets notified starting this many days before the customer's birthday. */
const BIRTHDAY_NOTICE_DAYS_BEFORE = 2;

/**
 * Texts the customer their new birthday discount code — best-effort, same as
 * notifyAdminOfNewOrder in orders.ts: a MeliPayamak failure (no credit,
 * rejected number, unset body id) must never fail the code-creation request.
 * {0} in the approved template is the customer's first name (falling back to
 * "مشتری" when they haven't set one), {1} is the code.
 */
async function notifyCustomerOfBirthdayDiscount(
  customer: { phone: string; firstName: string | null },
  code: string,
): Promise<void> {
  if (!env.melipayamakBirthdayBodyId) return;
  const name = customer.firstName?.trim() || "مشتری";
  try {
    await sendPatternSms(customer.phone, env.melipayamakBirthdayBodyId, [name, code]);
  } catch (err) {
    console.error("Failed to send birthday discount SMS:", err);
  }
}

/**
 * Read-only lookup for the customer's own profile page: is there an
 * unexpired, unused birthday discount code for this customer? Generation
 * itself is a separate, admin-triggered step (see createBirthdayDiscountCode)
 * — this never creates one.
 */
export async function getActiveBirthdayDiscount(
  customerId: string,
): Promise<{ code: string; percent: number; expiresAt: string } | null> {
  const existing = await prisma.discountCode.findFirst({
    where: { customerId, source: "birthday" },
    orderBy: { createdAt: "desc" },
  });
  if (!existing || !existing.expiresAt) return null;
  if (existing.expiresAt.getTime() < Date.now()) return null;
  return existing.usedAt
    ? null
    : { code: existing.code, percent: existing.percent, expiresAt: existing.expiresAt.toISOString() };
}

/**
 * Starting BIRTHDAY_NOTICE_DAYS_BEFORE days before the customer's birthday
 * (Tehran calendar) through the birthday itself, makes sure the admin has a
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
  const occurrence = nextTehranMonthDayOccurrence(birthDate, now);
  const daysUntil = tehranCalendarDayDiff(now, occurrence);
  if (daysUntil > BIRTHDAY_NOTICE_DAYS_BEFORE) return;

  const existing = await prisma.adminMessage.findFirst({
    where: { customerId, type: "birthday" },
    orderBy: { createdAt: "desc" },
  });
  if (existing && tehranCalendarDayDiff(existing.createdAt, now) <= BIRTHDAY_NOTICE_DAYS_BEFORE) return;

  const customer = await prisma.customer.findUnique({ where: { id: customerId } });
  if (!customer) return;
  const name = [customer.firstName, customer.lastName].filter(Boolean).join(" ") || customer.phone;
  const body =
    daysUntil === 0
      ? `امروز تولد ${name} است. یک کد تخفیف تولد براش ایجاد کن.`
      : `${daysUntil} روز دیگر تولد ${name} است. از همین حالا می‌تونی کد تخفیف تولدش رو ایجاد کنی.`;

  await prisma.adminMessage.create({
    data: {
      type: "birthday",
      customerId,
      title: "تولد مشتری 🎂",
      body,
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
 * customer whose birthday is coming up within BIRTHDAY_NOTICE_DAYS_BEFORE
 * days, independent of whether that customer ever opens the app. This app
 * has no external task scheduler, so a plain interval on the running Node
 * process stands in for a cron job — call this once, from the server
 * entrypoint, after it starts listening.
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
 * Admin-triggered: creates the customer's personal, single-use birthday
 * discount code at the percent the admin chose. The code is usable as soon
 * as it's created — even up to BIRTHDAY_NOTICE_DAYS_BEFORE days ahead of the
 * birthday — and expires at 23:59:59 (Tehran time) on the birthday itself.
 * Marks the triggering message as actioned (and read).
 */
export async function createBirthdayDiscountCode(
  customerId: string,
  percent: number,
  messageId?: string,
): Promise<{ id: string; code: string; percent: number }> {
  const customer = await prisma.customer.findUnique({ where: { id: customerId } });
  if (!customer || !customer.birthDate) {
    throw new Error("تاریخ تولد مشتری ثبت نشده است");
  }

  const now = new Date();
  const occurrence = nextTehranMonthDayOccurrence(customer.birthDate, now);
  const expiresAt = tehranEndOfDay(occurrence);

  let created: { id: string; code: string; percent: number } | null = null;
  for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt++) {
    const code = generateBirthdayDiscountCode();
    try {
      created = await prisma.discountCode.create({
        data: {
          code,
          percent,
          customerId,
          expiresAt,
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

  await notifyCustomerOfBirthdayDiscount(customer, created.code);

  return created;
}
