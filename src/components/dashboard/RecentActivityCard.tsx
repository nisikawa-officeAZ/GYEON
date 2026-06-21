"use client";

// PHASE66-B: Recent activity card.

import type { RecentActivity } from "@/lib/dashboard/get-dashboard-summary";

const TYPE_ICON: Record<string, string> = {
  estimate:   "⊛",
  work_order: "⊟",
  invoice:    "⊝",
  payment:    "⊕",
};

const TYPE_COLOR: Record<string, string> = {
  estimate:   "text-blue-400",
  work_order: "text-green-400",
  invoice:    "text-amber-400",
  payment:    "text-emerald-400",
};

const TYPE_LABEL: Record<string, string> = {
  estimate:   "見積",
  work_order: "施工",
  invoice:    "請求",
  payment:    "入金",
};

function formatDate(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso.slice(0, 10);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

interface Props {
  activities: RecentActivity[];
}

export default function RecentActivityCard({ activities }: Props) {
  return (
    <div className="rounded-xl border border-slate-800 bg-[#0a0f1a] overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-800 bg-[#0f172a]">
        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">最近のアクティビティ</span>
      </div>

      {activities.length === 0 ? (
        <div className="py-10 text-center">
          <p className="text-xs text-slate-600">最近のアクティビティはありません。</p>
        </div>
      ) : (
        <div className="flex flex-col divide-y divide-slate-800/40">
          {activities.map(a => (
            <div key={`${a.type}-${a.id}`} className="flex items-start gap-3 px-5 py-3">
              {/* Icon */}
              <div className="flex flex-col items-center gap-1 shrink-0 pt-0.5">
                <span className={`text-sm ${TYPE_COLOR[a.type] ?? "text-slate-500"}`}>
                  {TYPE_ICON[a.type] ?? "○"}
                </span>
                <span className={`text-[8px] font-medium ${TYPE_COLOR[a.type] ?? "text-slate-600"}`}>
                  {TYPE_LABEL[a.type] ?? a.type}
                </span>
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-xs text-slate-200 truncate font-medium">{a.label}</p>
                  <p className="text-[10px] text-slate-600 shrink-0">{formatDate(a.date)}</p>
                </div>
                <p className="text-[10px] text-slate-500 mt-0.5">{a.sub_label}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
