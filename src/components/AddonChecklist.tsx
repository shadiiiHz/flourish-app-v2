"use client";

import { Check } from "lucide-react";
import type { MenuItemAddon } from "../config/siteConfig";

/** Tickable list of a product's optional addons, shown before adding it to the cart. */
function AddonChecklist({
  addons,
  selectedIds,
  onToggle,
}: {
  addons: MenuItemAddon[];
  selectedIds: ReadonlySet<string>;
  onToggle: (id: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-bold text-cocoa-900">
        افزودنی‌ها <span className="text-xs font-normal text-cocoa-500">(اختیاری)</span>
      </h3>
      {addons.map((addon) => {
        const checked = selectedIds.has(addon.id);
        return (
          <label
            key={addon.id}
            className={`flex cursor-pointer items-center gap-3 rounded-2xl border p-3 transition ${
              checked ? "border-sand-400 bg-sand-50" : "border-sand-100 bg-white"
            }`}
          >
            <input
              type="checkbox"
              checked={checked}
              onChange={() => onToggle(addon.id)}
              className="sr-only"
            />
            <span
              aria-hidden="true"
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition ${
                checked ? "border-sand-400 bg-sand-400 text-white" : "border-cocoa-900/20 bg-white"
              }`}
            >
              {checked && <Check className="h-3.5 w-3.5" />}
            </span>
            <span className="min-w-0 flex-1 text-sm font-semibold text-cocoa-900">{addon.name}</span>
            <span className="shrink-0 text-xs font-bold text-sand-400">
              {addon.price > 0 ? `+${addon.price.toLocaleString("fa-IR")} تومان` : "رایگان"}
            </span>
          </label>
        );
      })}
    </div>
  );
}

export default AddonChecklist;
