"use client";

import { useEffect, useState } from "react";
import { Radio } from "lucide-react";
import { adminGetDailyAnalytics, adminGetLiveAnalytics, type DailyAnalyticsPoint } from "@/lib/api";
import { gregorianToJalali, PERSIAN_MONTHS } from "@/lib/jalali";
import { toPersianDigits } from "@/lib/formatNumber";

const LIVE_POLL_MS = 5000;

const POLL_MS = 15000;
const DAYS = 10;

const VIEW_WIDTH = 760;
const VIEW_HEIGHT = 280;
const MARGIN = { top: 20, right: 16, bottom: 34, left: 44 };
const PLOT_WIDTH = VIEW_WIDTH - MARGIN.left - MARGIN.right;
const PLOT_HEIGHT = VIEW_HEIGHT - MARGIN.top - MARGIN.bottom;

interface Point {
  x: number;
  y: number;
}

/**
 * Paul Heckbert's "nice numbers for graph labels": rounds `value` to 1, 2, 5,
 * or 10 × a power of ten — the smallest such "nice" step, or (when `round`
 * is false) the smallest one that's still ≥ value, e.g. for finding a nice
 * axis range that comfortably covers the data.
 */
function niceNumber(value: number, round: boolean): number {
  if (value <= 0) return 0;
  const exponent = Math.floor(Math.log10(value));
  const fraction = value / Math.pow(10, exponent);
  let niceFraction: number;
  if (round) {
    if (fraction < 1.5) niceFraction = 1;
    else if (fraction < 3) niceFraction = 2;
    else if (fraction < 7) niceFraction = 5;
    else niceFraction = 10;
  } else {
    if (fraction <= 1) niceFraction = 1;
    else if (fraction <= 2) niceFraction = 2;
    else if (fraction <= 5) niceFraction = 5;
    else niceFraction = 10;
  }
  return niceFraction * Math.pow(10, exponent);
}

/**
 * A y-axis max and evenly-spaced tick step, both "nice" numbers (e.g.
 * 0/500/1000/1500/2000), covering `maxDataValue`. Visit/visitor counts are
 * always whole numbers, so the step is never allowed below 1 — otherwise a
 * small data range (e.g. max 2) "nicely" rounds to a 0.5 step, and rounding
 * those to integers for display collapses distinct ticks into duplicates
 * (0, 0.5, 1, 1.5, 2 → shown as 0, 1, 1, 2, 2).
 */
function niceAxisScale(maxDataValue: number, tickCount: number): { max: number; ticks: number[] } {
  const safeMax = Math.max(1, maxDataValue);
  const range = niceNumber(safeMax, false);
  const step = Math.max(1, niceNumber(range / (tickCount - 1), true));
  const max = Math.ceil(safeMax / step) * step;
  const ticks = Array.from({ length: Math.round(max / step) + 1 }, (_, i) => i * step);
  return { max, ticks };
}

/** A smooth cardinal (Catmull-Rom-derived) spline through the given points, as an SVG path "d". */
function smoothPath(points: Point[]): string {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i === 0 ? i : i - 1];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2 < points.length ? i + 2 : i + 1];
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${cp1x} ${cp1y} ${cp2x} ${cp2y} ${p2.x} ${p2.y}`;
  }
  return d;
}

function formatDayLabel(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const { jm, jd } = gregorianToJalali(y, m, d);
  return toPersianDigits(`${jd} ${PERSIAN_MONTHS[jm - 1]}`);
}

const SERIES = [
  { key: "visits" as const, label: "تعداد بازدید", color: "#22c55e" },
  { key: "visitors" as const, label: "تعداد بازدیدکننده", color: "#f97316" },
];

function VisitsLineChart() {
  const [days, setDays] = useState<DailyAnalyticsPoint[] | null>(null);
  const [liveVisitors, setLiveVisitors] = useState(0);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      adminGetDailyAnalytics(DAYS).then((res) => {
        if (!cancelled) setDays(res.days);
      });
    };
    load();
    const timer = window.setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      adminGetLiveAnalytics().then((res) => {
        if (!cancelled) setLiveVisitors(res.liveVisitors);
      });
    };
    load();
    const timer = window.setInterval(load, LIVE_POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  const points = days ?? [];
  const { max: maxValue, ticks } = niceAxisScale(
    Math.max(1, ...points.flatMap((p) => [p.visits, p.visitors])),
    5,
  );

  const xFor = (index: number) =>
    points.length > 1 ? MARGIN.left + (index / (points.length - 1)) * PLOT_WIDTH : MARGIN.left;
  const yFor = (value: number) => MARGIN.top + (1 - value / maxValue) * PLOT_HEIGHT;

  return (
    <div className="mt-4 rounded-[1.5rem] border border-sand-100 bg-white p-5 shadow-[0_16px_40px_-24px_rgba(138,84,39,0.35)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-base font-bold text-cocoa-900">آمار بازدید</h2>
          <p className="mt-0.5 text-xs text-cocoa-500">
            آمار بازدید {toPersianDigits(String(DAYS))} روز اخیر
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-full bg-sand-50 px-4 py-2">
          <Radio className="h-4 w-4 text-sand-500" />
          <span className="text-sm font-bold text-cocoa-900">{toPersianDigits(String(liveVisitors))}</span>
          <span className="text-xs font-semibold text-cocoa-500">بازدیدکننده آنلاین</span>
        </div>
      </div>

      {!days ? (
        <p className="mt-6 text-sm text-cocoa-500">در حال بارگذاری…</p>
      ) : (
        <>
          <div className="relative mt-3">
            <svg
              viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
              className="w-full"
              role="img"
              aria-label="نمودار آمار بازدید"
            >
              {/* Gridlines + y-axis labels */}
              {ticks.map((value) => {
                const y = yFor(value);
                return (
                  <g key={value}>
                    <line
                      x1={MARGIN.left}
                      x2={VIEW_WIDTH - MARGIN.right}
                      y1={y}
                      y2={y}
                      stroke="#f1e4d8"
                      strokeWidth={1}
                    />
                    <text
                      x={MARGIN.left - 8}
                      y={y}
                      textAnchor="end"
                      dominantBaseline="middle"
                      fill="#6e6b45"
                      className="text-[10px]"
                    >
                      {toPersianDigits(String(Math.round(value)))}
                    </text>
                  </g>
                );
              })}

              {/* X-axis day labels */}
              {points.map((p, i) => (
                <text
                  key={p.date}
                  x={xFor(i)}
                  y={VIEW_HEIGHT - MARGIN.bottom + 18}
                  textAnchor="middle"
                  fill="#6e6b45"
                  className="text-[10px]"
                >
                  {formatDayLabel(p.date)}
                </text>
              ))}

              {/* Hovered-day guide line, drawn under the series so the dots stay on top */}
              {hoveredIndex !== null && (
                <line
                  x1={xFor(hoveredIndex)}
                  x2={xFor(hoveredIndex)}
                  y1={MARGIN.top}
                  y2={VIEW_HEIGHT - MARGIN.bottom}
                  stroke="#d8c3ab"
                  strokeWidth={1}
                  strokeDasharray="3 3"
                />
              )}

              {/* Series lines + dots */}
              {SERIES.map((series) => {
                const seriesPoints = points.map((p, i) => ({ x: xFor(i), y: yFor(p[series.key]) }));
                return (
                  <g key={series.key}>
                    <path d={smoothPath(seriesPoints)} fill="none" stroke={series.color} strokeWidth={2.5} />
                    {seriesPoints.map((pt, i) => (
                      <circle
                        key={i}
                        cx={pt.x}
                        cy={pt.y}
                        r={hoveredIndex === i ? 6 : 4}
                        fill={series.color}
                        stroke="#fff"
                        strokeWidth={hoveredIndex === i ? 2 : 0}
                        className="transition-all"
                      />
                    ))}
                  </g>
                );
              })}

              {/* Invisible per-day hit columns, on top so hover works anywhere near a point */}
              {points.map((_, i) => (
                <rect
                  key={i}
                  x={xFor(i) - PLOT_WIDTH / points.length / 2}
                  y={MARGIN.top}
                  width={PLOT_WIDTH / points.length}
                  height={PLOT_HEIGHT}
                  fill="transparent"
                  onMouseEnter={() => setHoveredIndex(i)}
                  onMouseLeave={() => setHoveredIndex((prev) => (prev === i ? null : prev))}
                />
              ))}
            </svg>

            {hoveredIndex !== null && (
              <div
                className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-xl border border-white/40 bg-white/80 px-3 py-2 text-xs shadow-[inset_0_1px_0_0_rgba(255,255,255,0.5),0_20px_40px_-16px_rgba(74,44,18,0.45)] backdrop-blur-xl backdrop-saturate-150"
                style={{
                  left: `${(xFor(hoveredIndex) / VIEW_WIDTH) * 100}%`,
                  top: `${(yFor(Math.max(points[hoveredIndex].visits, points[hoveredIndex].visitors)) / VIEW_HEIGHT) * 100}%`,
                  marginTop: "-10px",
                }}
              >
                <p className="mb-1 font-bold text-cocoa-900">{formatDayLabel(points[hoveredIndex].date)}</p>
                {SERIES.map((series) => (
                  <div key={series.key} className="flex items-center gap-1.5 whitespace-nowrap text-cocoa-700">
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: series.color }}
                      aria-hidden="true"
                    />
                    <span>{series.label}:</span>
                    <span className="font-bold text-cocoa-900">
                      {toPersianDigits(String(points[hoveredIndex][series.key]))}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-center gap-5">
            {SERIES.map((series) => (
              <div key={series.key} className="flex items-center gap-1.5 text-xs font-semibold text-cocoa-600">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: series.color }}
                  aria-hidden="true"
                />
                {series.label}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default VisitsLineChart;
