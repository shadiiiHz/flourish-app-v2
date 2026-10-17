import type { Metadata } from "next";
import Image from "next/image";
import {
  Clock,
  Crown,
  Gift,
  Heart,
  Star,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import { getPublicLoyaltyInfo, type LoyaltyTier, type PublicLoyaltyInfo } from "@/lib/api";
import { PALETTES, tierIcon } from "./tierStyle";
import MyClubStatus from "./MyClubStatus";
import TierCarousel from "./TierCarousel";

export const metadata: Metadata = {
  title: "باشگاه مشتریان | فلوریش",
  description: "با هر خرید امتیاز جمع کنید، به سطوح بالاتر باشگاه مشتریان برسید و کش‌بک بیشتری بگیرید.",
};

export const revalidate = 60;

const fa = (n: number) => n.toLocaleString("fa-IR");

function TierCard({
  tier,
  index,
  total,
}: {
  tier: LoyaltyTier;
  index: number;
  total: number;
}) {
  const p = PALETTES[index % PALETTES.length];
  const Icon = tierIcon(index, total);

  return (
    <div
      className={`relative flex w-full shrink-0 snap-center flex-col items-center overflow-hidden rounded-[1.75rem] border px-3 sm:w-auto pt-0 pb-0 text-center shadow-[0_18px_36px_-24px_rgba(80,60,40,0.45)] ${p.card}`}
    >
      <span
        className={`-mt-0 flex h-16 w-16 translate-y-0 items-center justify-center rounded-full text-white shadow-lg ring-4 ring-white/70 ${p.circle} mt-4`}
      >
        <Icon className="h-8 w-8" />
      </span>
      <span className={`mt-3 rounded-full px-4 py-1 text-xs font-bold text-white ${p.badge}`}>
        سطح {fa(tier.level)}
      </span>
      <h3 className="mt-2 font-display text-xl font-extrabold text-cocoa-900" dir="ltr">
        {tier.name}
      </h3>

      <div className={`mt-3 w-full rounded-full px-3 py-2.5 ${p.pill}`}>
        <p className={`font-display text-3xl font-extrabold leading-none ${p.pillText}`}>
          {fa(tier.cashbackPercent)}٪
        </p>
        <p className={`mt-1 text-xs font-bold ${p.pillText}`}>کش‌بک</p>
      </div>

      <div className="mt-3 w-full rounded-2xl bg-white/75 p-3 text-start shadow-sm">
        <div className="flex items-center gap-2.5">
          <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${p.iconBox} ${p.iconText}`}>
            <Star className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-cocoa-600">امتیاز مورد نیاز</p>
            <p className={`text-sm font-extrabold ${p.label}`}>{fa(tier.minPoints)}</p>
          </div>
        </div>
      </div>

      <div className={`mt-4 flex h-12 w-[calc(100%+1.5rem)] items-end justify-center bg-white/55 pb-2 ${p.wave}`}>
        <Icon className="h-5 w-5" />
      </div>
    </div>
  );
}

const BENEFITS: { icon: LucideIcon; title: string; text: string; tint: string }[] = [
  {
    icon: Gift,
    title: "بازگشت واقعی پول",
    text: "با هر خرید، کش‌بک دریافت کنید و در خرید بعدی خرج کنید.",
    tint: "bg-[#ffdede] text-[#f06565]",
  },
  {
    icon: Star,
    title: "سطوح متنوع",
    text: "با امتیاز بیشتر، سطح بالاتر بروید.",
    tint: "bg-[#e8defd] text-[#8363e8]",
  },
  {
    icon: TrendingUp,
    title: "مزایای بیشتر",
    text: "در سطوح بالاتر، درصد کش‌بک بیشتر می‌شود.",
    tint: "bg-[#d9f1de] text-[#34a058]",
  },
  {
    icon: Heart,
    title: "خرید لذت‌بخش‌تر",
    text: "مشتری ویژه ما باشید!",
    tint: "bg-[#ffdbe9] text-[#ec5c93]",
  },
];

function buildRules({ decayPeriodMonths, cashbackExpiryDays }: PublicLoyaltyInfo) {
  const expiry = cashbackExpiryDays % 30 === 0 ? `${fa(cashbackExpiryDays / 30)} ماه` : `${fa(cashbackExpiryDays)} روز`;
  return [
    "بعد از پرداخت هر سفارش، درصدی از مبلغ بر اساس سطح شما به‌عنوان کش‌بک به کیف پولتان واریز می‌شود.",
    "هرچه امتیازتان بیشتر شود، به سطح بالاتر و درصد کش‌بک بیشتری می‌رسید.",
    `اعتبار کش‌بک کیف پول ${expiry} قابل استفاده است.`,
    `اگر ${fa(decayPeriodMonths)} ماه هیچ خریدی نداشته باشید، یک سطح پایین می‌آیید.`,
    "در زمان تولد مشتری، علاوه بر کش‌بکی که هر سطح دارد، هدایای متنوعی هم برای مشتریان باشگاه در نظر گرفته می‌شود.",
  ];
}

export default async function ClubPage() {
  const info = await getPublicLoyaltyInfo();
  const tiers = info?.tiers ?? [];
  const rules = info ? buildRules(info) : [];

  return (
    <div className="relative">
      {/* Lightens the footer box on this page only (the style is dropped when leaving it). */}
      <style>{`footer .backdrop-blur-2xl { background-color: rgba(255, 255, 255, 0.55); }`}</style>
      {/* Paints over the site-wide logo pattern so the whole page keeps one soft colour. */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 bg-[#fdf8f3]" />

      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
        {/* Hero */}
        <section className="grid items-center gap-6 md:grid-cols-2">
          <div className="text-center md:text-start">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#ffdbe9] px-4 py-1.5 text-sm font-bold text-[#d6457f]">
              <Crown className="h-4 w-4" />
              باشگاه مشتریان
            </span>
            <h1 className="mt-5 font-display text-4xl leading-snug font-extrabold text-cocoa-900 sm:text-5xl">
              هر خرید،
              <br />
              یک قدم به سطح بالاتر!
            </h1>
            <p className="mx-auto mt-5 max-w-md text-sm leading-8 font-semibold text-[#5b5f87] sm:text-base md:mx-0">
              با خریدهای بیشتر، امتیاز جمع کنید و به سطوح بالاتر باشگاه مشتریان بپیوندید. هر سطح، درصد کش‌بک
              بیشتری دارد تا خریدهای شما لذت‌بخش‌تر شود.
            </p>
          </div>

          <div className="relative mx-auto w-full max-w-md">
            <Image
              src="/club/cat-mascot.png"
              alt="گربه تاج‌دار با سکه کش‌بک"
              width={513}
              height={339}
              priority
              className="animate-float-slow h-auto w-full drop-shadow-xl"
            />
          </div>
        </section>

        {/* The signed-in visitor's own standing */}
        <div className="mt-8">
          <MyClubStatus />
        </div>

        {/* Tiers */}
        {tiers.length > 0 && (
          <section className="mt-8 rounded-[2rem] border border-white/70 bg-white/55 p-4 shadow-[0_24px_50px_-32px_rgba(164,72,25,0.4)] backdrop-blur-xl sm:p-6">
            <TierCarousel tiers={tiers.map(({ level, name }) => ({ level, name }))}>
              {tiers.map((tier, i) => (
                <TierCard
                  key={tier.level}
                  tier={tier}
                  index={i}
                  total={tiers.length}
                />
              ))}
            </TierCarousel>
          </section>
        )}

        {/* Benefits */}
        <section className="mt-8 grid grid-cols-1 gap-5 rounded-[2rem] border border-white/70 bg-[#f6f1ff]/70 p-6 sm:grid-cols-2 lg:grid-cols-4">
          {BENEFITS.map(({ icon: Icon, title, text, tint }) => (
            <div key={title} className="flex flex-col items-center text-center">
              <span className={`flex h-14 w-14 items-center justify-center rounded-full ${tint}`}>
                <Icon className="h-6 w-6" />
              </span>
              <h3 className="mt-3 font-display text-base font-extrabold text-cocoa-900">{title}</h3>
              <p className="mt-1 text-xs leading-6 font-semibold text-cocoa-600">{text}</p>
            </div>
          ))}
        </section>

        {/* How it works */}
        {rules.length > 0 && (
          <section className="mt-8 rounded-[2rem] border border-white/70 bg-white/60 p-6 backdrop-blur-xl sm:p-8">
            <h2 className="flex items-center gap-2 font-display text-xl font-extrabold text-cocoa-900">
              <Clock className="h-5 w-5 text-[#ff8fb8]" />
              کش‌بک چطور کار می‌کند؟
            </h2>
            <ol className="mt-5 grid gap-3 sm:grid-cols-2">
              {rules.map((text, i) => (
                <li key={i} className="flex items-start gap-3 rounded-2xl bg-white/70 p-4">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-[#ffb27a] to-[#ff8fb8] text-sm font-extrabold text-white">
                    {fa(i + 1)}
                  </span>
                  <p className="pt-0.5 text-sm leading-7 font-semibold text-cocoa-700">{text}</p>
                </li>
              ))}
            </ol>
          </section>
        )}
      </div>
    </div>
  );
}
