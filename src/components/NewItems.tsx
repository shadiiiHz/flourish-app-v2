"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { MenuItem } from "../config/siteConfig";
import ProductCard from "./ProductCard";

interface NewItemsProps {
  items: MenuItem[];
}

function NewItems({ items }: NewItemsProps) {
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

  return (
    <section className="relative px-3 py-8 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex items-center justify-between sm:mb-10">
          <h2 className="font-display text-xl font-bold text-cocoa-900 sm:text-2xl">
            آیتم‌های جدید
          </h2>
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

export default NewItems;
