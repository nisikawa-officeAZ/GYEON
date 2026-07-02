"use client";

import type { RecommendationLevel } from "@/lib/capacity/capacity-types";

export type CapacityCategory = RecommendationLevel | "closed";

const ITEMS: Array<{ key: CapacityCategory; label: string; dot: string }> = [
  { key: "available", label: "空きあり", dot: "bg-emerald-500" },
  { key: "limited",   label: "やや混雑", dot: "bg-yellow-500" },
  { key: "warning",   label: "要注意",   dot: "bg-orange-500" },
  { key: "high_load", label: "高負荷",   dot: "bg-red-500" },
  { key: "closed",    label: "定休",     dot: "bg-slate-600" },
];

interface Props {
  filter: Record<CapacityCategory, boolean>;
  onToggle: (c: CapacityCategory) => void;
}

/**
 * Heatmap legend + show/hide filter (month/week only). Each chip is a toggle:
 * enabled = shown, disabled = matching days are de-emphasized in the grid.
 * Display-only — does not affect reservations or capacity calculation.
 */
export default function CalendarCapacityLegend({ filter, onToggle }: Props) {
  return (
    <div className="flex items-center flex-wrap gap-1.5" role="group" aria-label="稼働レベルの表示切替">
      <span className="text-[10px] text-slate-500 mr-1">稼働:</span>
      {ITEMS.map((it) => {
        const on = filter[it.key];
        return (
          <button
            key={it.key}
            type="button"
            onClick={() => onToggle(it.key)}
            aria-pressed={on}
            title={on ? `${it.label}を表示中（クリックで非表示）` : `${it.label}は非表示（クリックで表示）`}
            className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] border transition-colors ${
              on
                ? "border-slate-600 bg-slate-800 text-slate-200"
                : "border-slate-800 bg-transparent text-slate-500 line-through"
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${it.dot} ${on ? "" : "opacity-40"}`} aria-hidden />
            {it.label}
          </button>
        );
      })}
    </div>
  );
}
