"use client";

// PHASE66-B: Maintenance due card.
// Shows maintenance stats with urgency badges and links to maintenance page.
// Individual maintenance records require a separate query; shown here as aggregated stats.

import type { MaintenanceDashboardStats, LineStats } from "@/lib/dashboard/get-dashboard-summary";
import Link from "next/link";

interface Props {
  maintenance: MaintenanceDashboardStats;
  lineStats:   LineStats;
}

interface StatRowProps {
  label:   string;
  value:   number;
  badge?:  "red" | "amber" | "green" | "blue";
  urgent?: boolean;
}

function StatRow({ label, value, badge, urgent }: StatRowProps) {
  const valueColor =
    badge === "red"   ? "text-red-400 font-bold" :
    badge === "amber" ? "text-amber-400 font-semibold" :
    badge === "green" ? "text-green-400" :
    badge === "blue"  ? "text-blue-400"  :
    "text-slate-300";

  return (
    <div className={`flex items-center justify-between py-2.5 border-b border-slate-800/50 last:border-0 ${urgent ? "bg-red-950/10 -mx-5 px-5" : ""}`}>
      <div className="flex items-center gap-2">
        {urgent && <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />}
        <p className="text-xs text-slate-400">{label}</p>
      </div>
      <div className="flex items-center gap-2">
        <span className={`text-sm ${valueColor}`}>{value}</span>
        {urgent && value > 0 && (
          <span className="text-[10px] px-1.5 py-0.5 rounded border border-red-700/50 text-red-400 bg-red-950/30">
            要対応
          </span>
        )}
      </div>
    </div>
  );
}

export default function MaintenanceDueCard({ maintenance, lineStats }: Props) {
  const hasPending = maintenance.pending > 0;

  return (
    <div className="rounded-xl border border-slate-800 bg-[#0a0f1a] overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800 bg-[#0f172a]">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
            メンテナンス
          </span>
          {hasPending && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-900/50 text-red-300 border border-red-800/50">
              未送信 {maintenance.pending}
            </span>
          )}
        </div>
        <Link href="/maintenance" className="text-[10px] text-slate-500 hover:text-slate-300 transition-colors">
          一覧へ →
        </Link>
      </div>

      <div className="px-5 py-1">
        <StatRow label="今月のメンテナンス予定" value={maintenance.this_month}      badge="blue"  />
        <StatRow label="7日以内の通知予定"       value={maintenance.next_7_days}     badge={maintenance.next_7_days > 0 ? "amber" : undefined} />
        <StatRow label="未送信通知"               value={maintenance.pending}         badge={maintenance.pending > 0 ? "red" : undefined}   urgent={maintenance.pending > 0} />
        <StatRow label="今月送信済み"             value={maintenance.sent_this_month} badge={maintenance.sent_this_month > 0 ? "green" : undefined} />
      </div>

      {/* LINE stats */}
      <div className="border-t border-slate-800 px-5 py-3 flex items-center justify-between bg-slate-900/20">
        <div className="flex items-center gap-4">
          <div>
            <p className="text-[10px] text-slate-600">LINE友達</p>
            <p className="text-sm font-semibold text-slate-300">{lineStats.friends_count}</p>
          </div>
          <div>
            <p className="text-[10px] text-slate-600">連携済み</p>
            <p className="text-sm font-semibold text-green-400">{lineStats.linked_count}</p>
          </div>
        </div>
        <Link
          href="/line"
          className="text-[10px] px-2.5 py-1.5 rounded-lg border border-sky-800/50 text-sky-400 bg-sky-950/20 hover:bg-sky-900/30 transition-colors"
        >
          LINE管理
        </Link>
      </div>
    </div>
  );
}
