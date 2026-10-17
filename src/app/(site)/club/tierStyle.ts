import { Crown, Flower, Flower2, Leaf, Sprout, type LucideIcon } from "lucide-react";

export type Palette = {
  card: string;
  circle: string;
  badge: string;
  pill: string;
  pillText: string;
  iconBox: string;
  iconText: string;
  label: string;
  wave: string;
};

/** One pastel palette per level, cycled when the admin configures more than five. */
export const PALETTES: Palette[] = [
  {
    card: "border-[#fbe3a6] bg-linear-to-b from-[#fff8e6] to-[#fff1c9]",
    circle: "bg-linear-to-br from-[#ffc24d] to-[#f59e0b]",
    badge: "bg-[#ffb92e]",
    pill: "bg-[#ffeaa8]/70",
    pillText: "text-[#d98a00]",
    iconBox: "bg-[#fff1c9]",
    iconText: "text-[#f59e0b]",
    label: "text-[#b7791f]",
    wave: "text-[#fbd77a]",
  },
  {
    card: "border-[#cfe3ff] bg-linear-to-b from-[#eef6ff] to-[#dcebff]",
    circle: "bg-linear-to-br from-[#6aa8ff] to-[#3b82f6]",
    badge: "bg-[#4a90f5]",
    pill: "bg-[#cfe3ff]/70",
    pillText: "text-[#2f6fd6]",
    iconBox: "bg-[#dcebff]",
    iconText: "text-[#3b82f6]",
    label: "text-[#2f6fd6]",
    wave: "text-[#a9cdfb]",
  },
  {
    card: "border-[#ffd0d0] bg-linear-to-b from-[#fff0f0] to-[#ffdede]",
    circle: "bg-linear-to-br from-[#ff8d8d] to-[#f06565]",
    badge: "bg-[#f87474]",
    pill: "bg-[#ffd0d0]/70",
    pillText: "text-[#e0475b]",
    iconBox: "bg-[#ffdede]",
    iconText: "text-[#e0475b]",
    label: "text-[#d64560]",
    wave: "text-[#ffb3b3]",
  },
  {
    card: "border-[#dccfff] bg-linear-to-b from-[#f5f0ff] to-[#e8defd]",
    circle: "bg-linear-to-br from-[#a98cf5] to-[#8363e8]",
    badge: "bg-[#9a7af0]",
    pill: "bg-[#dccfff]/70",
    pillText: "text-[#6d4fd1]",
    iconBox: "bg-[#e8defd]",
    iconText: "text-[#8363e8]",
    label: "text-[#6d4fd1]",
    wave: "text-[#c7b3f8]",
  },
  {
    card: "border-[#bfe6c8] bg-linear-to-b from-[#eefaf0] to-[#d9f1de]",
    circle: "bg-linear-to-br from-[#5fc27a] to-[#34a058]",
    badge: "bg-[#42ae64]",
    pill: "bg-[#c9ecd2]/70",
    pillText: "text-[#2a8a49]",
    iconBox: "bg-[#d9f1de]",
    iconText: "text-[#34a058]",
    label: "text-[#2a8a49]",
    wave: "text-[#a2dbb0]",
  },
];

const TIER_ICONS: LucideIcon[] = [Sprout, Leaf, Flower2, Flower, Crown];

export function tierIcon(index: number, total: number): LucideIcon {
  if (index === total - 1) return Crown;
  return TIER_ICONS[index % (TIER_ICONS.length - 1)];
}
