import type { SeasonalThemeId } from "@/lib/api";

export interface SeasonalTheme {
  id: SeasonalThemeId;
  /** Season name, e.g. "بهار". */
  label: string;
  title: string;
  subtitle: string;
  /** Background of the frosted-glass panel (also used for the admin picker preview). */
  panelBackground: string;
  panelBorder: string;
  panelShadow: string;
  /** Title / accent colors. */
  titleColor: string;
  accent: string;
  /** Pill behind the season icon. */
  badgeBackground: string;
  /** Small swatch used by the admin theme picker. */
  swatch: string;
}

export const SEASONAL_THEMES: Record<SeasonalThemeId, SeasonalTheme> = {
  spring: {
    id: "spring",
    label: "بهار",
    title: "طعم‌های بهاری",
    subtitle: "شکوفه‌های تازه، طعم‌های روشن",
    panelBackground: "linear-gradient(135deg, rgba(255,182,208,0.38), rgba(255,255,255,0.55) 55%, rgba(255,182,208,0.22))",
    panelBorder: "rgba(255,255,255,0.75)",
    panelShadow: "0 30px 60px -30px rgba(214,86,128,0.45)",
    titleColor: "#7a2a47",
    accent: "#d6568a",
    badgeBackground: "linear-gradient(135deg, #ff9fc0, #f7c6d9)",
    swatch: "linear-gradient(135deg, #ff9fc0, #9be0a6)",
  },
  summer: {
    id: "summer",
    label: "تابستان",
    title: "طعم‌های تابستانی",
    subtitle: "خنک، شاداب و پر از آفتاب",
    panelBackground: "linear-gradient(135deg, rgba(255,214,120,0.38), rgba(255,255,255,0.55) 55%, rgba(255,214,120,0.22))",
    panelBorder: "rgba(255,255,255,0.8)",
    panelShadow: "0 30px 60px -30px rgba(240,140,30,0.5)",
    titleColor: "#8a4a07",
    accent: "#f08c1e",
    badgeBackground: "linear-gradient(135deg, #ffd04d, #ff9a3c)",
    swatch: "linear-gradient(135deg, #ffd04d, #5cc4f2)",
  },
  autumn: {
    id: "autumn",
    label: "پاییز",
    title: "طعم‌های پاییزی",
    subtitle: "گرم، عطرآگین و دلنشین",
    panelBackground: "linear-gradient(135deg, rgba(232,150,86,0.38), rgba(255,255,255,0.55) 55%, rgba(232,150,86,0.22))",
    panelBorder: "rgba(255,240,222,0.75)",
    panelShadow: "0 30px 60px -30px rgba(150,70,20,0.55)",
    titleColor: "#5e2a0e",
    accent: "#c4511a",
    badgeBackground: "linear-gradient(135deg, #e8833a, #b8421a)",
    swatch: "linear-gradient(135deg, #e8833a, #8a4a2a)",
  },
  winter: {
    id: "winter",
    label: "زمستان",
    title: "طعم‌های زمستانی",
    subtitle: "گرمای یک لقمه در روزهای سرد",
    panelBackground: "linear-gradient(135deg, rgba(150,190,240,0.38), rgba(255,255,255,0.55) 55%, rgba(150,190,240,0.22))",
    panelBorder: "rgba(255,255,255,0.85)",
    panelShadow: "0 30px 60px -30px rgba(60,100,170,0.45)",
    titleColor: "#1f3a63",
    accent: "#3f78c4",
    badgeBackground: "linear-gradient(135deg, #8cb9f0, #5b8fd6)",
    swatch: "linear-gradient(135deg, #bcd6f7, #5b8fd6)",
  },
};

export const SEASONAL_THEME_IDS = Object.keys(SEASONAL_THEMES) as SeasonalThemeId[];
