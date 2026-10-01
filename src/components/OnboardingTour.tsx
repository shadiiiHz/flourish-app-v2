"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  CalendarClock,
  Sparkles,
  User,
  UtensilsCrossed,
  X,
  ShoppingBag,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { toPersianDigits } from "@/lib/formatNumber";

interface TourStep {
  id: string;
  /** `data-tour` value of the element to spotlight; omitted for a centered card. */
  target?: string;
  /** Route the target lives on — the tour navigates there first. */
  path?: string;
  icon: LucideIcon;
  title: string;
  body: string;
}

const STEPS: TourStep[] = [
  {
    id: "welcome",
    icon: Sparkles,
    title: "به فلوریش خوش آمدید",
    body: "با یک تور کوتاه، بخش‌های مهم سایت را به شما نشان می‌دهیم تا خریدتان سریع‌تر و راحت‌تر شود.",
  },
  {
    id: "menu",
    target: "menu",
    path: "/",
    icon: UtensilsCrossed,
    title: "منوی فلوریش",
    body: "همه نان‌ها، شیرینی‌ها و نوشیدنی‌ها به‌صورت دسته‌بندی‌شده در منو قرار دارند. از اینجا وارد منو شوید.",
  },
  {
    id: "preorder",
    target: "preorder",
    path: "/menu",
    icon: CalendarClock,
    title: "ثبت پیش‌سفارش",
    body: "روز و ساعت دلخواه‌تان را انتخاب کنید تا سفارش‌تان دقیقاً سر وقت و تازه آماده شود.",
  },
  {
    id: "cart",
    target: "cart",
    icon: ShoppingBag,
    title: "سبد خرید",
    body: "محصولات انتخابی‌تان اینجا جمع می‌شوند و از همین‌جا سفارش را نهایی می‌کنید.",
  },
  {
    id: "profile",
    target: "profile",
    icon: User,
    title: "حساب کاربری",
    body: "سفارش‌ها، آدرس‌ها و کیف پول (اعتبار بازگشتی) را از منوی حساب کاربری مدیریت کنید.",
  },
];

/**
 * Visual style of the tour card. Flip this one line to switch designs:
 * "glass" (frosted, rich) or "minimal" (frosted, light and airy: hairline progress, text buttons).
 */
type TourDesign = "glass" | "minimal";
const TOUR_DESIGN: TourDesign = "minimal";

const DESIGN = {
  glass: {
    dim: "rgba(0,0,0,0.62)",
    card: "rounded-[1.75rem] border border-white/60 bg-gradient-to-br from-white/85 via-white/70 to-sand-50/60 p-5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.9),inset_0_-1px_0_0_rgba(255,255,255,0.3),0_30px_80px_-20px_rgba(0,0,0,0.55)] backdrop-blur-2xl backdrop-saturate-150",
    arrow: "border-white/60 bg-white/80",
    close: "bg-white/50 text-cocoa-500 hover:bg-white/90",
    prev: "border border-white/70 bg-white/50 text-cocoa-700 hover:bg-white/90",
    skip: "text-cocoa-500 hover:bg-white/60",
    next: "bg-gradient-to-b from-sand-400 to-sand-500 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.35),0_10px_20px_-8px_rgba(164,72,25,0.6)] hover:scale-[1.02] active:scale-95",
  },
  minimal: {
    dim: "rgba(20,12,6,0.55)",
    card: "rounded-3xl border border-white/60 bg-white/55 p-6 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.9),0_24px_70px_-20px_rgba(0,0,0,0.5)] backdrop-blur-2xl backdrop-saturate-150",
    arrow: "border-white/60 bg-white/75",
    close: "border border-white/60 bg-white/40 text-cocoa-500 backdrop-blur-md hover:bg-white/80",
    prev: "border border-white/60 bg-white/40 text-cocoa-700 backdrop-blur-md hover:bg-white/80",
    skip: "border border-white/60 bg-white/40 text-cocoa-500 backdrop-blur-md hover:bg-white/80",
    next: "border border-white/30 bg-sand-500/85 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.35),0_6px_16px_-8px_rgba(164,72,25,0.6)] backdrop-blur-md hover:bg-sand-500 active:scale-[0.98]",
  },
} as const;

const TOUR_PATHS = ["/", "/menu"];
const START_DELAY_MS = 1200;
const TARGET_WAIT_MS = 3000;
const SPOT_PADDING = 8;
const CARD_WIDTH = 340;
const VIEWPORT_GUTTER = 12;
const CARD_GAP = 16;
const storageKey = (phone: string) => `flourish-tour-done:${phone}`;

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
  radius: number;
}

function measure(el: Element): Rect {
  const r = el.getBoundingClientRect();
  // Some targets (the cart button) are visually round but have no border-radius
  // of their own — let them opt in so the spotlight matches what the eye sees.
  const radius =
    el.getAttribute("data-tour-shape") === "circle"
      ? 9999
      : parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0;
  return { top: r.top, left: r.left, width: r.width, height: r.height, radius };
}

function sameRect(a: Rect | null, b: Rect) {
  return (
    !!a &&
    Math.abs(a.top - b.top) < 0.5 &&
    Math.abs(a.left - b.left) < 0.5 &&
    Math.abs(a.width - b.width) < 0.5 &&
    Math.abs(a.height - b.height) < 0.5
  );
}

function readDone(phone: string) {
  try {
    return window.localStorage.getItem(storageKey(phone)) === "1";
  } catch {
    return false;
  }
}

function writeDone(phone: string) {
  try {
    window.localStorage.setItem(storageKey(phone), "1");
  } catch {
    // storage unavailable — the server flag is the source of truth anyway
  }
}

function OnboardingTour() {
  const { user, isLoading, finishOnboarding } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const [mounted, setMounted] = useState(false);
  const [steps, setSteps] = useState<TourStep[] | null>(null);
  const [index, setIndex] = useState(0);
  const [targetEl, setTargetEl] = useState<Element | null>(null);
  const [rect, setRect] = useState<Rect | null>(null);
  const [viewport, setViewport] = useState({ w: 0, h: 0 });
  // True between router.push() and the destination's target appearing — the
  // site's full-screen route Preloader is on screen then, so the tour hides
  // instead of stacking a second overlay on top of it.
  const [navigating, setNavigating] = useState(false);
  const startedRef = useRef(false);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  const phone = user?.phone;
  const needsTour = !!user && !user.onboardingCompleted && !(phone && readDone(phone));

  // Start once per page load, a moment after login so the success toast and
  // route transition settle first.
  useEffect(() => {
    if (isLoading || !needsTour || startedRef.current) return;
    if (!TOUR_PATHS.includes(pathname)) return;
    const timer = window.setTimeout(() => {
      startedRef.current = true;
      // Already on the menu page → skip the "go to the menu" step.
      setSteps(pathname === "/menu" ? STEPS.filter((s) => s.id !== "menu") : STEPS);
      setIndex(0);
    }, START_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [isLoading, needsTour, pathname]);

  // Logged out mid-tour → tear it down and allow a fresh start for the next user.
  useEffect(() => {
    if (!user && steps) {
      setSteps(null);
      startedRef.current = false;
    }
  }, [user, steps]);

  const step = steps?.[index] ?? null;

  const end = useCallback(() => {
    if (phone) writeDone(phone);
    finishOnboarding();
    setSteps(null);
    setTargetEl(null);
    setRect(null);
  }, [phone, finishOnboarding]);

  const next = useCallback(() => {
    if (!steps) return;
    if (index >= steps.length - 1) end();
    else setIndex(index + 1);
  }, [steps, index, end]);

  const prev = () => setIndex((i) => Math.max(0, i - 1));

  // Navigate to the step's page, then wait for its target to exist.
  useEffect(() => {
    setTargetEl(null);
    setRect(null);
    if (!step?.target) {
      setNavigating(false);
      return;
    }
    if (step.path && pathname !== step.path) {
      setNavigating(true);
      router.push(step.path);
      return;
    }
    let cancelled = false;
    let scrolled = false;
    const startedAt = performance.now();
    const poll = window.setInterval(() => {
      const el = document.querySelector(`[data-tour="${step.target}"]`);
      if (el && !scrolled) {
        scrolled = true;
        el.scrollIntoView({ block: "center", behavior: "smooth" });
        window.setTimeout(() => {
          if (cancelled) return;
          setTargetEl(el);
          setNavigating(false);
        }, 350);
      } else if (!el && performance.now() - startedAt > TARGET_WAIT_MS) {
        window.clearInterval(poll);
        if (!cancelled) {
          setNavigating(false);
          next(); // target missing (e.g. feature hidden) → skip the step
        }
      }
      if (scrolled) window.clearInterval(poll);
    }, 100);
    return () => {
      cancelled = true;
      window.clearInterval(poll);
    };
  }, [step?.id, pathname]);

  // Keep the spotlight glued to the target through scroll / resize / layout shifts.
  useEffect(() => {
    if (!targetEl) return;
    let raf = 0;
    const tick = () => {
      const r = measure(targetEl);
      setRect((cur) => (sameRect(cur, r) ? cur : r));
      setViewport((cur) =>
        cur.w === window.innerWidth && cur.h === window.innerHeight
          ? cur
          : { w: window.innerWidth, h: window.innerHeight },
      );
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [targetEl]);

  useEffect(() => {
    if (!steps) return;
    setViewport({ w: window.innerWidth, h: window.innerHeight });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") end();
      // RTL: the "next" arrow points left.
      else if (e.key === "ArrowLeft") next();
      else if (e.key === "ArrowRight") prev();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [steps, end, next]);

  // Park keyboard focus on the card (not a button) so no focus ring flashes on open.
  useEffect(() => {
    if (steps) cardRef.current?.focus({ preventScroll: true });
  }, [steps, index]);

  if (!mounted || !steps || !step) return null;

  const isCentered = !step.target;
  const isLast = index === steps.length - 1;
  const waiting = !isCentered && !rect;
  const Icon = step.icon;
  const D = DESIGN[TOUR_DESIGN];
  const minimal = TOUR_DESIGN === "minimal";

  const cardWidth = Math.min(CARD_WIDTH, viewport.w - VIEWPORT_GUTTER * 2);
  let cardStyle: React.CSSProperties = {};
  let arrow: { left: number; below: boolean } | null = null;
  if (!isCentered && rect && viewport.w) {
    const spaceBelow = viewport.h - (rect.top + rect.height + SPOT_PADDING);
    const spaceAbove = rect.top - SPOT_PADDING;
    const below = spaceBelow >= 230 || spaceBelow >= spaceAbove;
    const center = rect.left + rect.width / 2;
    const left = Math.min(
      Math.max(center - cardWidth / 2, VIEWPORT_GUTTER),
      viewport.w - cardWidth - VIEWPORT_GUTTER,
    );
    cardStyle = below
      ? { left, top: rect.top + rect.height + SPOT_PADDING + CARD_GAP }
      : { left, bottom: viewport.h - rect.top + SPOT_PADDING + CARD_GAP };
    arrow = { left: Math.min(Math.max(center - left, 24), cardWidth - 24), below };
  }

  return createPortal(
    <div className="fixed inset-0 z-[130]" role="dialog" aria-modal="true" aria-label="راهنمای سایت">
      {/* Click shield — keeps the page inert while the tour is running. */}
      <div className="absolute inset-0" onClick={(e) => e.stopPropagation()} />

      {navigating ? null : isCentered || waiting ? (
        <motion.div
          initial={false}
          animate={{ opacity: 1 }}
          style={{ backgroundColor: D.dim }}
          className="absolute inset-0 backdrop-blur-[2px]"
        />
      ) : (
        rect && (
          <motion.div
            initial={false}
            animate={{
              top: rect.top - SPOT_PADDING,
              left: rect.left - SPOT_PADDING,
              width: rect.width + SPOT_PADDING * 2,
              height: rect.height + SPOT_PADDING * 2,
              borderRadius: rect.radius + SPOT_PADDING,
            }}
            // Radius snaps instead of springing, so a pill → circle change never flashes a square.
            transition={{
              type: "spring",
              stiffness: 320,
              damping: 34,
              borderRadius: { duration: 0 },
            }}
            style={{ boxShadow: `0 0 0 9999px ${D.dim}` }}
            className="pointer-events-none absolute"
          >
            {minimal ? (
              <span aria-hidden="true" className="absolute inset-0 rounded-[inherit] ring-1 ring-white/90" />
            ) : (
              <motion.span
                aria-hidden="true"
                className="absolute inset-0 rounded-[inherit] ring-2 ring-sand-100"
                animate={{ opacity: [0.9, 0.2, 0.9], scale: [1, 1.06, 1] }}
                transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
              />
            )}
          </motion.div>
        )
      )}

      <AnimatePresence mode="wait">
        {!waiting && !navigating && (
          <motion.div
            key={step.id}
            initial={{ opacity: 0, y: 14, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 340, damping: 30 }}
            style={isCentered ? { width: cardWidth || CARD_WIDTH } : { ...cardStyle, width: cardWidth }}
            ref={cardRef}
            tabIndex={-1}
            className={`absolute overflow-hidden outline-none ${D.card} ${
              isCentered ? "start-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rtl:translate-x-1/2" : ""
            }`}
          >
            {arrow && (
              <span
                aria-hidden="true"
                style={{ left: arrow.left - 8 }}
                className={`absolute h-4 w-4 rotate-45 ${D.arrow} ${
                  arrow.below ? "-top-2 rounded-tl-md border-t border-l" : "-bottom-2 rounded-br-md border-r border-b"
                }`}
              />
            )}

            {/* Same logo pattern as the site background, etched into the glass. */}
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 -z-10 opacity-[0.05]"
              style={{
                backgroundImage: "url(/assets/logo.png)",
                backgroundRepeat: "repeat",
                backgroundSize: "80px 80px",
              }}
            />

            <span
              aria-hidden="true"
              className="pointer-events-none absolute -start-10 -top-12 h-32 w-32 rounded-full bg-sand-100/50 blur-3xl"
            />

            <button
              type="button"
              onClick={end}
              aria-label="بستن راهنما"
              className={`absolute end-3 top-3 flex h-7 w-7 items-center justify-center rounded-full outline-none transition ${D.close}`}
            >
              <X className="h-3.5 w-3.5" strokeWidth={1.8} />
            </button>

            {minimal ? (
              <div className="relative flex items-center gap-2 text-sand-500">
                <span className="flex h-8 w-8 items-center justify-center rounded-full border border-white/60 bg-white/45 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.8)] backdrop-blur-md">
                  <Icon className="h-[17px] w-[17px]" strokeWidth={1.6} />
                </span>
                <span className="text-[11px] font-semibold tracking-wide">
                  {toPersianDigits(`${index + 1} / ${steps.length}`)}
                </span>
              </div>
            ) : (
              <span className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-sand-300 to-sand-500 text-white shadow-[inset_0_1px_0_0_rgba(255,255,255,0.45),0_10px_20px_-8px_rgba(164,72,25,0.65)]">
                <Icon className="h-6 w-6" strokeWidth={1.8} />
              </span>
            )}

            <h2
              className={`font-display font-extrabold text-cocoa-900 ${
                minimal ? "mt-4 text-[17px] sm:text-lg" : "mt-3.5 text-base sm:text-lg"
              }`}
            >
              {step.title}
            </h2>
            <p className="mt-1.5 text-[13px] leading-6 text-cocoa-500 sm:text-sm sm:leading-7">
              {step.body}
            </p>

            {minimal ? (
              <div aria-hidden="true" className="mt-5 h-0.5 w-full overflow-hidden rounded-full bg-white/60">
                <motion.div
                  className="h-0.5 rounded-full bg-sand-500"
                  initial={false}
                  animate={{ width: `${((index + 1) / steps.length) * 100}%` }}
                  transition={{ type: "spring", stiffness: 260, damping: 32 }}
                />
              </div>
            ) : (
              <div className="mt-5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-1.5" aria-hidden="true">
                  {steps.map((s, i) => (
                    <span
                      key={s.id}
                      className={`h-1.5 rounded-full transition-all duration-300 ${
                        i === index ? "w-5 bg-sand-500" : i < index ? "w-1.5 bg-sand-300" : "w-1.5 bg-sand-100"
                      }`}
                    />
                  ))}
                </div>
                <span className="text-[11px] font-semibold text-cocoa-500">
                  {toPersianDigits(`${index + 1} از ${steps.length}`)}
                </span>
              </div>
            )}

            <div className={`flex items-center gap-2 ${minimal ? "mt-5" : "mt-4"}`}>
              {index > 0 ? (
                <button
                  type="button"
                  onClick={prev}
                  className={`flex items-center gap-1 rounded-full px-3.5 py-2 text-xs font-medium outline-none transition ${D.prev}`}
                >
                  <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.8} />
                  قبلی
                </button>
              ) : (
                <button
                  type="button"
                  onClick={end}
                  className={`rounded-full px-3.5 py-2 text-xs font-medium outline-none transition ${D.skip}`}
                >
                  رد کردن
                </button>
              )}
              <button
                type="button"
                onClick={next}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold text-white outline-none transition-transform focus-visible:ring-2 focus-visible:ring-sand-200 focus-visible:ring-offset-2 focus-visible:ring-offset-white/60 ${D.next}`}
              >
                {isLast ? "شروع خرید" : index === 0 ? "شروع تور" : "بعدی"}
                {!isLast && <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.8} />}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>,
    document.body,
  );
}

export default OnboardingTour;
