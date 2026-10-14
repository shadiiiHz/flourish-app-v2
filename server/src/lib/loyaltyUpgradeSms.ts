import { env } from "./env.js";
import { applyLoyaltyDecay, getCustomerPoints, getLoyaltyTiers, tierForPoints } from "./loyalty.js";
import { prisma } from "./prisma.js";
import { sendPatternSms } from "./sms.js";

/**
 * Texts a customer when they move up a loyalty level. Call it after anything that can raise their
 * points (an order becoming paid, an admin editing an order). Safe to call as often as you like:
 * Customer.loyaltyNotifiedLevel remembers the level they were last told about, the update that
 * records a new level is atomic (so concurrent calls send one SMS), and a lower current level just
 * resets that marker so a later climb back up is announced again.
 * Best-effort, like the other MeliPayamak notifications: it never throws.
 * Approved template: {0} = the new level's name, {1} = its cashback percent.
 */
export async function notifyLoyaltyUpgrade(customerId: string | null | undefined): Promise<void> {
  if (!customerId) return;
  try {
    await applyLoyaltyDecay(customerId);
    const [customer, points, tiers] = await Promise.all([
      prisma.customer.findUnique({ where: { id: customerId }, select: { phone: true, loyaltyNotifiedLevel: true } }),
      getCustomerPoints(customerId),
      getLoyaltyTiers(),
    ]);
    if (!customer) return;
    const tier = tierForPoints(points, tiers);
    if (tier.level === customer.loyaltyNotifiedLevel) return;

    const claimed = await prisma.customer.updateMany({
      where: { id: customerId, loyaltyNotifiedLevel: customer.loyaltyNotifiedLevel },
      data: { loyaltyNotifiedLevel: tier.level },
    });
    if (claimed.count === 0 || tier.level < customer.loyaltyNotifiedLevel) return;
    if (!env.melipayamakLoyaltyUpgradeBodyId) return;

    await sendPatternSms(customer.phone, env.melipayamakLoyaltyUpgradeBodyId, [tier.name, String(tier.cashbackPercent)]);
  } catch (err) {
    console.error("Failed to send loyalty upgrade SMS:", err);
  }
}
