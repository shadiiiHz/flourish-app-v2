"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { CalendarClock, Clock, MapPin, Phone, Wallet } from "lucide-react";
import { siteConfig, type Category, type CategoryTab, type CategoryTabId } from "@/config/siteConfig";
import ProductCard from "@/components/ProductCard";
import { useOrderType } from "@/context/OrderTypeContext";
import { formatPreorderDateWithWeekday } from "@/lib/preorder";

const persianDigits = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];
const toPersianDigits = (value: string) =>
  value.replace(/\d/g, (digit) => persianDigits[Number(digit)]);

type PageSection = "menu" | "info";

interface CategoryMenuViewProps {
  tabs: CategoryTab[];
  categoriesByTab: Record<CategoryTabId, Category[]>;
  walletCashbackPercent: number;
  bannerImage: string;
}

function CategoryMenuView({
  tabs,
  categoriesByTab,
  walletCashbackPercent,
  bannerImage,
}: CategoryMenuViewProps) {
  const { orderType, preorder, openModal } = useOrderType();
  const hasPreorder = orderType === "preorder" && !!preorder;
  const flatCategories = useMemo(
    () =>
      tabs.flatMap((tab) =>
        categoriesByTab[tab.id].map((category) => ({
          id: category.id,
          groupId: tab.id,
        })),
      ),
    [tabs, categoriesByTab],
  );

  const [activeSection, setActiveSection] = useState<PageSection>("menu");
  const [activeGroup, setActiveGroup] = useState<CategoryTabId>("drinks");
  const [activeCategoryId, setActiveCategoryId] = useState<string>("");
  const [headerHeight, setHeaderHeight] = useState(0);
  const navRef = useRef<HTMLDivElement>(null);
  const chipTrackRef = useRef<HTMLDivElement>(null);
  const categoryRefs = useRef<Record<string, HTMLElement | null>>({});

  useEffect(() => {
    const headerEl = document.getElementById("site-header");
    if (!headerEl) return;
    const update = () => setHeaderHeight(headerEl.offsetHeight);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(headerEl);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      if (flatCategories.length === 0) return;
      const navHeight = navRef.current?.offsetHeight ?? 0;
      const offset = headerHeight + navHeight + 24;
      let current = flatCategories[0];
      for (const cat of flatCategories) {
        const el = categoryRefs.current[cat.id];
        if (el && el.getBoundingClientRect().top - offset <= 0) {
          current = cat;
        }
      }
      setActiveGroup(current.groupId);
      setActiveCategoryId(current.id);
    };
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [headerHeight, flatCategories]);

  useEffect(() => {
    const container = chipTrackRef.current;
    if (!container) return;
    const activeBtn = container.querySelector<HTMLElement>(
      `[data-category-id="${activeCategoryId}"]`,
    );
    activeBtn?.scrollIntoView({
      behavior: "smooth",
      inline: "center",
      block: "nearest",
    });
  }, [activeCategoryId]);

  useEffect(() => {
    let cancelled = false;
    let attempts = 0;

    const scrollToEl = (behavior: ScrollBehavior) => {
      const id = window.location.hash.slice(1);
      if (!id) return true;
      const el = document.getElementById(id);
      if (!el) return false;
      const headerEl = document.getElementById("site-header");
      const navHeight = navRef.current?.offsetHeight ?? 0;
      const offset = (headerEl?.offsetHeight ?? 0) + navHeight + 16;
      const top = el.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top, behavior });
      return true;
    };

    const attemptScroll = () => {
      if (cancelled) return;
      if (!scrollToEl("smooth")) {
        if (attempts < 50) {
          attempts += 1;
          window.setTimeout(attemptScroll, 100);
        }
        return;
      }
      for (const delay of [300, 700, 1200]) {
        window.setTimeout(() => {
          if (!cancelled) scrollToEl("smooth");
        }, delay);
      }
    };

    const timer = window.setTimeout(attemptScroll, 60);
    window.addEventListener("hashchange", attemptScroll);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      window.removeEventListener("hashchange", attemptScroll);
    };
  }, []);

  const goToCategory = (id: string) => {
    const el = categoryRefs.current[id];
    if (!el) return;
    const navHeight = navRef.current?.offsetHeight ?? 0;
    const top =
      el.getBoundingClientRect().top +
      window.scrollY -
      headerHeight -
      navHeight -
      16;
    window.scrollTo({ top, behavior: "smooth" });
  };

  const goToGroup = (id: CategoryTabId) => {
    const firstCategoryId = categoriesByTab[id][0]?.id;
    if (!firstCategoryId) return;
    setActiveGroup(id);
    setActiveCategoryId(firstCategoryId);
    goToCategory(firstCategoryId);
  };

  const handleCategoryClick = (id: string, groupId: CategoryTabId) => {
    setActiveGroup(groupId);
    setActiveCategoryId(id);
    goToCategory(id);
  };

  return (
    <div className="relative">
      <section className="relative px-3 pt-8 sm:px-6 sm:pt-10">
        <div className="relative mx-auto h-[320px] max-w-6xl overflow-hidden rounded-[2.25rem] border border-sand-100 shadow-[0_30px_60px_-25px_rgba(138,84,39,0.35)] sm:h-[420px] sm:rounded-[3rem]">
          <img
            src={bannerImage}
            alt="بوتیک نان و شیرینی فلوریش"
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-l from-black/80 via-black/30 to-transparent" />
          <div className="absolute inset-0 flex flex-col items-start justify-end gap-2 p-6 text-right sm:p-10">
            <h1 className="font-display text-2xl font-bold text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.5)] sm:text-3xl md:text-4xl">
              بوتیک نان و شیرینی فلوریش
            </h1>
            <p className="text-sm text-white/85 drop-shadow-[0_2px_6px_rgba(0,0,0,0.5)] sm:text-base">
              {siteConfig.contact.address}
            </p>

            <div className="mt-2 flex w-fit items-center gap-1 rounded-full border border-white/40 bg-white/20 p-1.5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.3),0_10px_30px_-12px_rgba(0,0,0,0.45)] backdrop-blur-2xl backdrop-saturate-150">
              {(
                [
                  { id: "menu", label: "منو" },
                  { id: "info", label: "اطلاعات مجموعه" },
                ] as const
              ).map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setActiveSection(id)}
                  className="relative rounded-full px-5 py-2.5 text-xs font-bold transition-colors sm:px-8 sm:text-sm"
                >
                  {activeSection === id && (
                    <motion.span
                      layoutId="menu-section-tab-highlight"
                      transition={{
                        type: "spring",
                        stiffness: 350,
                        damping: 30,
                      }}
                      className="absolute inset-0 rounded-full bg-white/90 shadow-[0_8px_20px_-8px_rgba(0,0,0,0.45)]"
                    />
                  )}
                  <span
                    className={`relative z-10 ${activeSection === id ? "text-cocoa-900" : "text-white"}`}
                  >
                    {label}
                  </span>
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={openModal}
              className="mt-2 flex items-center gap-1.5 rounded-full bg-sand-500 px-5 py-2.5 text-xs font-bold text-white shadow-[0_10px_20px_-8px_rgba(164,72,25,0.6)] transition-transform hover:scale-[1.02] active:scale-95 sm:text-sm"
            >
              <CalendarClock className="h-4 w-4 shrink-0" />
              {hasPreorder
                ? `پیش‌سفارش: ${formatPreorderDateWithWeekday(preorder.date)} ساعت ${preorder.timeSlot}`
                : "ثبت پیش‌سفارش"}
            </button>
          </div>
        </div>
      </section>

      {walletCashbackPercent > 0 && (
        <section className="px-3 pt-4 sm:px-6">
          <div className="mx-auto flex max-w-6xl justify-start">
            <div className="flex w-fit items-center gap-2.5 rounded-2xl border border-sand-100 bg-white/80 px-3 py-3 shadow-[0_15px_40px_-25px_rgba(138,84,39,0.35)] backdrop-blur-xl">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sand-500 text-white shadow-[0_8px_16px_-6px_rgba(164,72,25,0.6)]">
                <Wallet className="h-4 w-4" strokeWidth={1.9} />
              </span>
              <div>
                <h2 className="font-display text-xs font-bold text-cocoa-900 sm:text-sm">
                  اعتبار بازگشتی | CashBack
                </h2>
                <p className="mt-0.5 text-[11px] text-cocoa-500 sm:text-xs">
                  {toPersianDigits(String(walletCashbackPercent))}درصد اعتبار بازگشتی به کیف پول
                </p>
              </div>
            </div>
          </div>
        </section>
      )}

      {activeSection === "info" && (
        <div className="mx-auto max-w-5xl px-3 pb-16 pt-8 sm:px-6">
          <div className="grid gap-8 rounded-[2rem] border border-sand-100 bg-white/70 p-6 shadow-[0_20px_50px_-30px_rgba(138,84,39,0.3)] backdrop-blur-xl sm:p-8 md:grid-cols-2">
            <div className="flex flex-col gap-4">
              <div className="flex items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-sand-50 text-sand-500">
                  <MapPin className="h-5 w-5" strokeWidth={1.9} />
                </span>
                <div>
                  <h3 className="font-display text-sm font-bold text-cocoa-900 sm:text-base">
                    آدرس
                  </h3>
                  <p className="mt-1 text-sm leading-7 text-cocoa-600">
                    {siteConfig.contact.address}
                  </p>
                  <a
                    href={siteConfig.contact.mapUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-block text-xs font-semibold text-sand-500 transition-colors hover:text-sand-600"
                  >
                    مشاهده در نقشه
                  </a>
                </div>
              </div>

              <div className="aspect-square sm:h-50 sm:h-50 lg:h-100 lg:w-100 overflow-hidden rounded-[1.5rem] border border-sand-100">
                <iframe
                  src={siteConfig.contact.mapEmbedUrl}
                  title="موقعیت فلوریش روی نقشه"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  className="h-full w-full border-0"
                />
              </div>
            </div>

            <div className="flex flex-col gap-6">
              <div className="flex items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-sand-50 text-sand-500">
                  <Phone className="h-5 w-5" strokeWidth={1.9} />
                </span>
                <div>
                  <h3 className="font-display text-sm font-bold text-cocoa-900 sm:text-base">
                    تلفن
                  </h3>
                  <a
                    href={`tel:${siteConfig.contact.phone}`}
                    className="mt-1 inline-block text-sm text-cocoa-600 transition-colors hover:text-sand-500"
                  >
                    {toPersianDigits(siteConfig.contact.phone)}
                  </a>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-sand-50 text-sand-500">
                  <Clock className="h-5 w-5" strokeWidth={1.9} />
                </span>
                <div>
                  <h3 className="font-display text-sm font-bold text-cocoa-900 sm:text-base">
                    ساعات کاری
                  </h3>
                  <p className="mt-1 text-sm text-cocoa-600">
                    {siteConfig.contact.hours}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeSection === "menu" && (
        <>
          <div
            ref={navRef}
            style={{ top: headerHeight }}
            className="sticky z-40 border-b border-sand-50/60 bg-cream/80 backdrop-blur-xl"
          >
            <div className="px-3 py-3 sm:px-6">
              <div className="mx-auto flex max-w-6xl justify-center">
                <div className="relative flex items-center gap-1 rounded-full border border-white/40 bg-white/40 p-1.5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.5),0_10px_30px_-12px_rgba(138,84,39,0.25)] backdrop-blur-2xl backdrop-saturate-150">
                  {tabs.map(({ id, label }) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => goToGroup(id)}
                      className="relative rounded-full px-5 py-2.5 text-xs font-bold transition-colors sm:px-8 sm:text-sm"
                    >
                      {activeGroup === id && (
                        <motion.span
                          layoutId="menu-group-tab-highlight"
                          transition={{
                            type: "spring",
                            stiffness: 350,
                            damping: 30,
                          }}
                          className="absolute inset-0 rounded-full bg-white/70 shadow-[0_8px_20px_-8px_rgba(138,84,39,0.45)]"
                        />
                      )}
                      <span
                        className={`relative z-10 ${activeGroup === id ? "text-cocoa-900" : "text-cocoa-500"}`}
                      >
                        {label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="border-t border-sand-50/60 px-3 py-2 sm:px-6">
              <div
                ref={chipTrackRef}
                className="mx-auto flex max-w-6xl gap-2 overflow-x-auto scroll-smooth px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              >
                {categoriesByTab[activeGroup].map((category) => (
                  <button
                    key={category.id}
                    type="button"
                    data-category-id={category.id}
                    onClick={() =>
                      handleCategoryClick(category.id, activeGroup)
                    }
                    className={`shrink-0 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors sm:text-[13px] ${
                      activeCategoryId === category.id
                        ? "border-sand-400 bg-sand-400 text-white"
                        : "border-sand-100 bg-white text-cocoa-600 hover:border-sand-200"
                    }`}
                  >
                    {category.title}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="mx-auto max-w-6xl px-3 pb-16 sm:px-6">
            {tabs.map(({ id: tabId, label }) => (
              <section key={tabId} className="pt-10">
                <h2 className="mb-6 font-display text-xl font-bold text-cocoa-900 sm:text-2xl">
                  {label}
                </h2>

                <div className="flex flex-col gap-10">
                  {categoriesByTab[tabId].map((category) => (
                    <div
                      key={category.id}
                      id={category.id}
                      ref={(el) => {
                        categoryRefs.current[category.id] = el;
                      }}
                      className="scroll-mt-52 sm:scroll-mt-60"
                    >
                      <div className="mb-4 flex items-center gap-3">
                        <img
                          src={category.image}
                          alt=""
                          className="h-10 w-10 rounded-full bg-transparent object-cover"
                        />
                        <div>
                          <h3 className="font-display text-lg font-bold text-cocoa-900">
                            {category.title}
                          </h3>
                          {category.note && (
                            <p className="mt-1 text-xs text-cocoa-500 sm:text-sm">
                              {category.note}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
                        {category.items.map((item) => (
                          <ProductCard
                            key={item.id}
                            item={item}
                            categoryTitle={category.title}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default CategoryMenuView;
