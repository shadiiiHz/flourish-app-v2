"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Category, CategoryTab, CategoryTabId } from "../config/siteConfig";

const containerVariants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.08 },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 28 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: "easeOut" as const },
  },
};

interface CategoriesProps {
  tabs: CategoryTab[];
  categoriesByTab: Record<CategoryTabId, Category[]>;
}

function Categories({ tabs, categoriesByTab }: CategoriesProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<CategoryTabId>("bakery");
  const categories = categoriesByTab[activeTab];
  const trackRef = useRef<HTMLDivElement>(null);
  const [sliderState, setSliderState] = useState({
    overflowing: false,
    atStart: true,
    atEnd: true,
  });

  const updateSliderState = () => {
    const track = trackRef.current;
    if (!track) return;
    const maxScroll = track.scrollWidth - track.clientWidth;
    if (maxScroll <= 4) {
      setSliderState({ overflowing: false, atStart: true, atEnd: true });
      return;
    }
    const pos = Math.abs(track.scrollLeft);
    setSliderState({
      overflowing: true,
      atStart: pos <= 4,
      atEnd: pos >= maxScroll - 4,
    });
  };

  useLayoutEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    track.scrollTo({ left: 0 });
    updateSliderState();

    const handleResize = () => updateSliderState();
    track.addEventListener("scroll", updateSliderState, { passive: true });
    window.addEventListener("resize", handleResize);
    return () => {
      track.removeEventListener("scroll", updateSliderState);
      window.removeEventListener("resize", handleResize);
    };
  }, [activeTab, categories]);

  const scrollByCard = (direction: "prev" | "next") => {
    const track = trackRef.current;
    if (!track) return;
    const card = track.querySelector("button");
    const cardWidth = card?.getBoundingClientRect().width ?? track.clientWidth;
    const gap = parseFloat(getComputedStyle(track).columnGap || "0") || 0;
    const step = cardWidth + gap;
    track.scrollBy({ left: direction === "next" ? -step : step, behavior: "smooth" });
  };

  return (
    <section className="relative px-3 py-16 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-10 flex justify-center sm:mb-10">
          <div className="relative flex items-center gap-1 rounded-full border border-white/40 bg-white/40 p-1.5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.5),0_10px_30px_-12px_rgba(138,84,39,0.25)] backdrop-blur-2xl backdrop-saturate-150">
            {tabs.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id)}
                className="relative rounded-full px-5 py-2.5 text-xs font-bold transition-colors sm:px-8 sm:text-sm"
              >
                {activeTab === id && (
                  <motion.span
                    layoutId="category-tab-highlight"
                    transition={{ type: "spring", stiffness: 350, damping: 30 }}
                    className="absolute inset-0 rounded-full bg-white/70 shadow-[0_8px_20px_-8px_rgba(138,84,39,0.45)]"
                  />
                )}
                <span
                  className={`relative z-10 ${activeTab === id ? "text-cocoa-900" : "text-cocoa-500"}`}
                >
                  {label}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="relative">
          <motion.div
            key={activeTab}
            ref={trackRef}
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className={`grid grid-flow-col auto-cols-[calc((100%_-_1.5rem)/3)] ${sliderState.overflowing ? "justify-start" : "justify-center"} overflow-x-auto snap-x snap-mandatory scroll-smooth px-1 pb-4 pt-4 sm:auto-cols-[calc((100%_-_4rem)/4)] gap-2 sm:gap-4 lg:auto-cols-[calc((100%_-_7rem)/7)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden`}
          >
            {categories.map(({ id, title, image }) => (
              <motion.button
                key={id}
                type="button"
                onClick={() => router.push(`/menu#${id}`)}
                variants={cardVariants}
                whileHover={{ y: -8, scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                className="group flex gap-2 sm:gap-1 snap-start flex-col items-center justify-center rounded-[1.75rem] border border-sand-50 bg-white text-center shadow-[0_16px_40px_-24px_rgba(138,84,39,0.35)] transition-colors hover:border-sand-100/70 hover:bg-sand-50/20 sm:rounded-[2rem] p-4 sm:p-2"
              >
                <img
                  src={image}
                  alt=""
                  className="h-12 w-12 object-cover rounded-full bg-transparent sm:h-15 sm:w-15"
                />
                <div className="flex flex-col gap-1">
                  <h3 className="font-display text-[11px] font-bold text-cocoa-900 sm:text-[12px]">
                    {title}
                  </h3>
                </div>
              </motion.button>
            ))}
          </motion.div>

          {sliderState.overflowing && (
            <>
              <button
                type="button"
                aria-label="آیتم‌های قبلی"
                onClick={() => scrollByCard("prev")}
                disabled={sliderState.atStart}
                className="absolute right-0 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 translate-x-1/3 items-center justify-center rounded-full border border-sand-100 bg-white text-cocoa-700 shadow-[0_16px_40px_-24px_rgba(138,84,39,0.5)] transition-opacity disabled:pointer-events-none disabled:opacity-0 sm:h-12 sm:w-12"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
              <button
                type="button"
                aria-label="آیتم‌های بعدی"
                onClick={() => scrollByCard("next")}
                disabled={sliderState.atEnd}
                className="absolute left-0 top-1/2 z-10 flex h-10 w-10 -translate-x-1/3 -translate-y-1/2 items-center justify-center rounded-full border border-sand-100 bg-white text-cocoa-700 shadow-[0_16px_40px_-24px_rgba(138,84,39,0.5)] transition-opacity disabled:pointer-events-none disabled:opacity-0 sm:h-12 sm:w-12"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

export default Categories;
