"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { PALETTES, tierIcon } from "./tierStyle";

const AUTO_PLAY_MS = 4000;
/** How long auto-play stays off after the visitor touches the row. */
const RESUME_AFTER_MS = 6000;

/**
 * Scroll-snap row that shows one card per slide on phones and a plain grid from `sm` up.
 * On phones a strip of level icons sits underneath: the current level's icon grows and takes
 * its colour, and tapping any icon jumps to that level.
 */
export default function TierCarousel({ children, tiers }: { children: ReactNode; tiers: { level: number; name: string }[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const activeRef = useRef(0);
  const pausedUntil = useRef(0);
  const visible = useRef(false);

  const onScroll = () => {
    const el = ref.current;
    const first = el?.children[0] as HTMLElement | undefined;
    if (!el || !first) return;
    const second = el.children[1] as HTMLElement | undefined;
    const step = second ? Math.abs(second.offsetLeft - first.offsetLeft) : first.offsetWidth;
    // scrollLeft is 0 → -max in RTL, so the absolute value is the distance travelled either way.
    const next = Math.min(tiers.length - 1, Math.max(0, Math.round(Math.abs(el.scrollLeft) / step)));
    activeRef.current = next;
    setActive(next);
  };

  // Scrolls only the row (never the page), so the icon strip stays exactly where the user tapped.
  const goTo = (i: number) => {
    const el = ref.current;
    const card = el?.children[i] as HTMLElement | undefined;
    if (!el || !card) return;
    const e = el.getBoundingClientRect();
    const c = card.getBoundingClientRect();
    el.scrollBy({ left: c.left - e.left - (e.width - c.width) / 2, behavior: "smooth" });
  };

  // Auto-play: step to the next level every few seconds while the row is on screen, scrollable
  // (phones only) and untouched; wrap back to the first level at the end.
  useEffect(() => {
    const el = ref.current;
    if (!el || tiers.length < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const io = new IntersectionObserver(([entry]) => (visible.current = entry.isIntersecting), { threshold: 0.5 });
    io.observe(el);
    const timer = window.setInterval(() => {
      if (!visible.current || Date.now() < pausedUntil.current) return;
      if (el.scrollWidth <= el.clientWidth + 4) return;
      goTo((activeRef.current + 1) % tiers.length);
    }, AUTO_PLAY_MS);
    return () => {
      io.disconnect();
      window.clearInterval(timer);
    };
  }, [tiers.length]);

  const pause = () => {
    pausedUntil.current = Date.now() + RESUME_AFTER_MS;
  };

  return (
    <div>
      <div
        ref={ref}
        onPointerDown={pause}
        onWheel={pause}
        onKeyDown={pause}
        onScroll={onScroll}
        className="flex snap-x snap-mandatory gap-3 overflow-x-auto py-2 [scrollbar-width:none] sm:grid sm:snap-none sm:grid-cols-2 sm:gap-4 sm:overflow-visible sm:py-0 lg:[grid-template-columns:repeat(var(--tiers),minmax(0,1fr))] [&::-webkit-scrollbar]:hidden"
        style={{ "--tiers": Math.min(tiers.length, 5) } as React.CSSProperties}
      >
        {children}
      </div>

      {tiers.length > 1 && (
        <div className="mt-3 flex h-12 items-center justify-center gap-2.5 sm:hidden" role="tablist" aria-label="سطح‌های باشگاه">
          {tiers.map((tier, i) => {
            const p = PALETTES[i % PALETTES.length];
            const Icon = tierIcon(i, tiers.length);
            const on = i === active;
            return (
              <button
                key={tier.level}
                type="button"
                role="tab"
                aria-selected={on}
                aria-label={tier.name}
                onClick={() => {
                  pause();
                  goTo(i);
                }}
                className={`flex items-center justify-center rounded-full transition-all duration-300 ${
                  on
                    ? `h-12 w-12 text-white shadow-lg ring-4 ring-white/80 ${p.circle}`
                    : `h-8 w-8 bg-white/80 shadow-sm ${p.iconText} opacity-60`
                }`}
              >
                <Icon className={on ? "h-6 w-6" : "h-4 w-4"} />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
