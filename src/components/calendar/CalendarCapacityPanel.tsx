"use client";

import type { CapacityResult, RecommendationLevel } from "@/lib/capacity/capacity-types";
import { recommendationLabel } from "@/lib/capacity/recommendation";

interface Props {
  capacity: CapacityResult | null;
  loading: boolean;
}

// Capacity color rules: Available=green, Limited=yellow, Warning=orange, High Load=red.
function levelBar(level: RecommendationLevel): string {
  switch (level) {
    case "available": return "bg-emerald-500";
    case "limited":   return "bg-yellow-500";
    case "warning":   return "bg-orange-500";
    case "high_load": return "bg-red-500";
  }
}
function levelBanner(level: RecommendationLevel): string {
  switch (level) {
    case "available": return "bg-emerald-500/15 border-emerald-500/40 text-emerald-300";
    case "limited":   return "bg-yellow-500/15 border-yellow-500/40 text-yellow-300";
    case "warning":   return "bg-orange-500/15 border-orange-500/40 text-orange-300";
    case "high_load": return "bg-red-500/15 border-red-500/40 text-red-300";
  }
}

function pct(peak: number, cap: number | null): number | null {
  return cap && cap > 0 ? Math.round(peak * 100) : null;
}

export default function CalendarCapacityPanel({ capacity, loading }: Props) {
  if (loading && !capacity) {
    return (
      <div className="rounded-xl border border-slate-800 bg-[#0f172a] px-3 py-2 text-[11px] text-slate-500">
        キャパシティを計算中…
      </div>
    );
  }
  if (!capacity) return null;

  const workshopPct = capacity.bottleneck ? Math.round(capacity.workshop.peak * 100) : null;
  const staffPct = pct(capacity.staff.peak, capacity.staff.cap);
  const bayPct = pct(capacity.bay.peak, capacity.bay.cap);
  const vehiclePct = pct(capacity.vehicle.peak, capacity.vehicle.cap);
  const estimated = capacity.confidence === "estimated";

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-slate-800 bg-[#0f172a] p-3">
      {/* Recommendation banner + workshop headline */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <span className={`px-2.5 py-1 rounded-md text-xs font-semibold border ${levelBanner(capacity.level)}`}>
          {recommendationLabel(capacity.level)}
        </span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">工房稼働</span>
          <span className="text-lg font-bold text-slate-100 tabular-nums">
            {workshopPct === null ? "—" : `${workshopPct}%`}
          </span>
          {estimated && <span className="text-[10px] text-slate-500">推定</span>}
        </div>
      </div>

      {/* Workshop meter */}
      <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden" role="meter"
        aria-label="工房稼働率" aria-valuenow={workshopPct ?? 0} aria-valuemin={0} aria-valuemax={100}>
        <div
          className={`h-full ${levelBar(capacity.level)} transition-all`}
          style={{ width: `${Math.min(workshopPct ?? 0, 100)}%` }}
        />
      </div>

      {/* Dimension readouts (mobile: wrap) */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px]">
        <span className="text-slate-300">
          スタッフ <span className="font-semibold tabular-nums">{staffPct === null ? "—" : `${staffPct}%`}</span>
        </span>
        <span className="text-slate-300">
          作業ベイ <span className="font-semibold tabular-nums">{bayPct === null ? "—" : `${bayPct}%`}</span>
        </span>
        {vehiclePct !== null && (
          <span className="text-slate-300">
            同時対応 <span className="font-semibold tabular-nums">{vehiclePct}%</span>
          </span>
        )}
        <span className="ml-auto text-slate-500">予約 {capacity.reservationCount} 件</span>
      </div>
    </div>
  );
}
