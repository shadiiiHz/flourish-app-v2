"use client";

import { useMemo, useState } from "react";
import {
  daysInJalaliMonth,
  gregorianToJalali,
  jalaliToGregorian,
  PERSIAN_MONTHS,
} from "@/lib/jalali";
import { toPersianDigits } from "@/lib/formatNumber";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

interface DraftParts {
  jy: string;
  jm: string;
  jd: string;
}

function toDraft(value: string): DraftParts {
  if (!value) return { jy: "", jm: "", jd: "" };
  const [gy, gm, gd] = value.split("-").map(Number);
  const { jy, jm, jd } = gregorianToJalali(gy, gm, gd);
  return { jy: String(jy), jm: String(jm), jd: String(jd) };
}

interface JalaliDateSelectProps {
  /** "YYYY-MM-DD" (Gregorian), or "" for no date selected. Only read once, on mount — pass a `key` at the call site to reset the picker when switching to a different record. */
  value: string;
  /** Receives "YYYY-MM-DD" (Gregorian) once all three of day/month/year are picked, or "" if any is cleared. */
  onChange: (value: string) => void;
  /** How many years before the current Jalali year the year dropdown reaches back to. */
  yearsBack?: number;
  /** How many years after the current Jalali year the year dropdown reaches forward to. */
  yearsForward?: number;
  className?: string;
}

const SELECT_CLASS =
  "w-full rounded-xl border border-cocoa-900/10 px-2 py-2.5 text-center text-sm outline-none focus:border-sand-400";

/**
 * Day/month/year Jalali picker for a Gregorian-backed date field — same UX as
 * the site's own birth-date picker. Keeps its own draft day/month/year state
 * instead of deriving it from `value` on every render: since `onChange` only
 * fires once all three are picked, deriving straight from `value` would wipe
 * out a partial selection (e.g. day+month picked, year not yet) back to
 * empty on every keystroke. Pass a `key` prop tied to the record's id at the
 * call site so switching which record is being edited resets the picker.
 */
function JalaliDateSelect({
  value,
  onChange,
  yearsBack = 100,
  yearsForward = 0,
  className = "",
}: JalaliDateSelectProps) {
  const [draft, setDraft] = useState<DraftParts>(() => toDraft(value));

  const currentJalaliYear = useMemo(() => {
    const now = new Date();
    return gregorianToJalali(now.getFullYear(), now.getMonth() + 1, now.getDate()).jy;
  }, []);

  const years = useMemo(
    () =>
      Array.from(
        { length: yearsBack + yearsForward + 1 },
        (_, i) => currentJalaliYear + yearsForward - i,
      ),
    [currentJalaliYear, yearsBack, yearsForward],
  );

  const maxDay = draft.jm
    ? daysInJalaliMonth(Number(draft.jy) || currentJalaliYear, Number(draft.jm))
    : 31;
  const days = Array.from({ length: maxDay }, (_, i) => i + 1);

  const update = (next: DraftParts) => {
    setDraft(next);
    if (!next.jy || !next.jm || !next.jd) {
      onChange("");
      return;
    }
    const clampedDay = Math.min(Number(next.jd), daysInJalaliMonth(Number(next.jy), Number(next.jm)));
    const { gy, gm, gd } = jalaliToGregorian(Number(next.jy), Number(next.jm), clampedDay);
    onChange(`${gy}-${pad(gm)}-${pad(gd)}`);
  };

  return (
    <div className={`grid grid-cols-3 gap-2 ${className}`}>
      <select
        value={draft.jd}
        onChange={(e) => update({ ...draft, jd: e.target.value })}
        className={SELECT_CLASS}
      >
        <option value="">روز</option>
        {days.map((d) => (
          <option key={d} value={d}>
            {toPersianDigits(String(d))}
          </option>
        ))}
      </select>
      <select
        value={draft.jm}
        onChange={(e) => update({ ...draft, jm: e.target.value })}
        className={SELECT_CLASS}
      >
        <option value="">ماه</option>
        {PERSIAN_MONTHS.map((name, i) => (
          <option key={name} value={i + 1}>
            {name}
          </option>
        ))}
      </select>
      <select
        value={draft.jy}
        onChange={(e) => update({ ...draft, jy: e.target.value })}
        className={SELECT_CLASS}
      >
        <option value="">سال</option>
        {years.map((y) => (
          <option key={y} value={y}>
            {toPersianDigits(String(y))}
          </option>
        ))}
      </select>
    </div>
  );
}

export default JalaliDateSelect;
