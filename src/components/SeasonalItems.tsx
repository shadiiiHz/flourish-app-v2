"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { MenuItem } from "../config/siteConfig";
import ProductCard from "./ProductCard";
import { SEASONAL_THEMES } from "../config/seasonalThemes";
import type { SeasonalThemeId } from "../lib/api";
import Image from "next/image";

interface SeasonalItemsProps {
  items: MenuItem[];
  theme: SeasonalThemeId;
}

/** Homepage seasonal section (above "new items"): glass panel styled after the season the admin picked. Hidden when empty. */
function SeasonalItems({ items, theme: themeId }: SeasonalItemsProps) {
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

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    updateSliderState();

    const handleResize = () => updateSliderState();
    track.addEventListener("scroll", updateSliderState, { passive: true });
    window.addEventListener("resize", handleResize);
    return () => {
      track.removeEventListener("scroll", updateSliderState);
      window.removeEventListener("resize", handleResize);
    };
  }, [items]);

  const scrollByCard = (direction: "prev" | "next") => {
    const track = trackRef.current;
    if (!track) return;
    const card = track.querySelector("article");
    const cardWidth = card?.getBoundingClientRect().width ?? track.clientWidth;
    const gap = parseFloat(getComputedStyle(track).columnGap || "0") || 0;
    const step = cardWidth + gap;
    track.scrollBy({
      left: direction === "next" ? -step : step,
      behavior: "smooth",
    });
  };

  if (items.length === 0) return null;

  const theme = SEASONAL_THEMES[themeId] ?? SEASONAL_THEMES.spring;

  return (
    <section className="relative px-3 py-8 sm:px-6">
      <div
        className="relative mx-auto max-w-6xl rounded-[2rem] border p-4 backdrop-blur-xl sm:p-7"
        style={{
          background: theme.panelBackground,
          borderColor: theme.panelBorder,
          boxShadow: theme.panelShadow,
        }}
      >
        {/* Anchored to the panel (not the full-width section) so zooming/resizing moves both together. */}
        <span className="pointer-events-none absolute top-0 left-0 z-20 flex h-25 w-25 shrink-0 items-start justify-center overflow-hidden md:-top-8 md:h-64 md:w-64">
          <Image
            src="/assets/autumn/2.svg"
            alt=""
            width={100}
            height={100}
            className="h-full w-full object-contain"
          />
        </span>

        <div className="mb-6 flex items-center gap-3 sm:mb-8">
          <span className="flex h-10 w-10 md:h-18 md:w-18 items-center justify-center shrink-0 overflow-hidden bg-transparent">
            <Image
              src="/assets/autumn/1.svg"
              alt=""
              width={72}
              height={72}
              className="h-full w-full object-contain"
            />
          </span>
          <div>
            <h2
              className="font-display text-xl font-bold sm:text-2xl"
              style={{ color: theme.titleColor }}
            >
              {theme.title}
            </h2>
            <p
              className="mt-0.5 text-xs sm:text-sm"
              style={{ color: theme.accent }}
            >
              {theme.subtitle}
            </p>
          </div>
        </div>

        <div className="relative">
          <div
            ref={trackRef}
            className="grid grid-flow-col auto-cols-[calc((100%_-_1rem)/1.08)] gap-4 overflow-x-auto snap-x snap-mandatory scroll-smooth px-1 pb-4 pt-1 sm:auto-cols-[calc((100%_-_2.5rem)/3)] sm:gap-5 lg:auto-cols-[calc((100%_-_5rem)/4)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {items.map((item) => (
              <ProductCard key={item.id} item={item} />
            ))}
          </div>

          {sliderState.overflowing && (
            <>
              <button
                type="button"
                aria-label="آیتم‌های قبلی"
                onClick={() => scrollByCard("prev")}
                disabled={sliderState.atStart}
                className="absolute right-0 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 translate-x-1/3 items-center justify-center rounded-full border border-white/70 bg-white/80 text-cocoa-700 backdrop-blur shadow-[0_16px_40px_-24px_rgba(138,84,39,0.5)] transition-opacity disabled:pointer-events-none disabled:opacity-0 sm:h-12 sm:w-12"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
              <button
                type="button"
                aria-label="آیتم‌های بعدی"
                onClick={() => scrollByCard("next")}
                disabled={sliderState.atEnd}
                className="absolute left-0 top-1/2 z-10 flex h-10 w-10 -translate-x-1/3 -translate-y-1/2 items-center justify-center rounded-full border border-white/70 bg-white/80 text-cocoa-700 backdrop-blur shadow-[0_16px_40px_-24px_rgba(138,84,39,0.5)] transition-opacity disabled:pointer-events-none disabled:opacity-0 sm:h-12 sm:w-12"
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

export default SeasonalItems;
