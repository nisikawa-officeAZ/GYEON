"use client";

// PHASE66-B: KPI cards — sales, customers, work orders, invoices, LINE, reservations.

import type { DashboardSummary } from "@/lib/dashboard/get-dashboard-summary";
import type { DealerPlanInfo }   from "@/lib/plans/plan-types";
import { planLabel, planBadgeColor, subscriptionStatusLabel, subscriptionStatusColor } from "@/lib/plans/plan-types";

function fmtYen(n: number) {
  if (n >= 100_000_000) return `¥${(n / 100_000_000).toFixed(1)}億`;
  if (n >= 10_000)      return `¥${Math.floor(n / 10_000).toLocaleString("ja-JP")}万`;
  return "¥" + n.toLocaleString("ja-JP");
}

interface KpiCardProps {
  label:   string;
  value:   string;
  sub?:    string;
  badge?:  "green" | "blue" | "amber" | "red" | "slate";
  compact?: boolean;
}

function KpiCard({ label, value, sub, badge, compact = false }: KpiCardProps) {
  const valueColor =
    badge === "green" ? "text-green-400" :
    badge === "blue"  ? "text-blue-400"  :
    badge === "amber" ? "text-amber-400" :
    badge === "red"   ? "text-red-400"   :
    "text-slate-100";

  const borderAccent =
    badge === "green" ? "border-green-900/40" :
    badge === "blue"  ? "border-blue-900/40"  :
    badge === "amber" ? "border-amber-900/40" :
    badge === "red"   ? "border-red-900/40"   :
    "border-slate-800";

  return (
    <div className={`rounded-xl border ${borderAccent} bg-[#0f172a] ${compact ? "p-3" : "p-4"}`}>
      <p className="text-[10px] text-slate-500 mb-1.5 leading-tight">{label}</p>
      <p className={`font-bold tracking-tight ${compact ? "text-xl" : "text-2xl"} ${valueColor}`}>{value}</p>
      {sub && <p className="text-[10px] text-slate-600 mt-1 truncate">{sub}</p>}
    </div>
  );
}

interface Props {
  summary:  DashboardSummary;
  today:    string;
  planInfo: DealerPlanInfo;
}

export default function DashboardKpiCards({ summary: s, today, planInfo }: Props) {
  const d         = new Date(today);
  const monthLabel = `${d.getFullYear()}年${d.getMonth() + 1}月`;
  const yearLabel  = `${d.getFullYear()}年`;

  return (
    <div className="flex flex-col gap-4">

      {/* Plan badge row */}
      <div className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl border border-slate-800 bg-[#0f172a]">
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center px-2.5 py-1 rounded-md border text-xs font-bold tracking-wide ${planBadgeColor(planInfo.plan)}`}>
            {planLabel(planInfo.plan)}
          </span>
          <span className={`text-xs font-medium ${subscriptionStatusColor(planInfo.subscription_status)}`}>
            {subscriptionStatusLabel(planInfo.subscription_status)}
          </span>
        </div>
        <div className="flex items-center gap-4 text-[10px] text-slate-500">
          {planInfo.started_at && <span>開始 {planInfo.started_at.slice(0, 10)}</span>}
          {planInfo.expired_at && <span>期限 {planInfo.expired_at.slice(0, 10)}</span>}
        </div>
      </div>

      {/* Sales KPIs */}
      <div>
        <p className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider mb-2 px-0.5">売上</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard label={`${monthLabel}売上`}   value={fmtYen(s.sales.monthly_sales)}    sub={`¥${s.sales.monthly_sales.toLocaleString("ja-JP")}`}    badge="green" />
          <KpiCard label={`${monthLabel}入金`}   value={fmtYen(s.sales.monthly_received)} sub={`¥${s.sales.monthly_received.toLocaleString("ja-JP")}`} badge="blue"  />
          <KpiCard label="未収金"                 value={fmtYen(s.sales.outstanding)}      sub={`¥${s.sales.outstanding.toLocaleString("ja-JP")}`}      badge={s.sales.outstanding > 0 ? "red" : undefined} />
          <KpiCard label={`${yearLabel}累計売上`} value={fmtYen(s.sales.yearly_sales)}     sub={`¥${s.sales.yearly_sales.toLocaleString("ja-JP")}`}     badge="amber" />
        </div>
      </div>

      {/* Operations KPIs */}
      <div>
        <p className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider mb-2 px-0.5">オペレーション</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <KpiCard label="顧客数"       value={String(s.customer_count)}         compact />
          <KpiCard label="車両数"       value={String(s.vehicle_count)}          compact />
          <KpiCard label="施工中"       value={String(s.work_orders.in_progress)} badge={s.work_orders.in_progress > 0 ? "amber" : undefined} compact />
          <KpiCard label="期限超過請求" value={String(s.invoices.overdue)}        badge={s.invoices.overdue > 0 ? "red" : undefined} compact />
        </div>
      </div>

      {/* Reservation + LINE KPIs */}
      <div>
        <p className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider mb-2 px-0.5">予約・LINE</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <KpiCard label="本日の予約"     value={String(s.reservation_stats.today)}          badge={s.reservation_stats.today > 0 ? "blue" : undefined}  compact />
          <KpiCard label="今週の予約"     value={String(s.reservation_stats.this_week)}       badge={s.reservation_stats.this_week > 0 ? "blue" : undefined} compact />
          <KpiCard label="仮予約"         value={String(s.reservation_stats.pending)}         badge={s.reservation_stats.pending > 0 ? "amber" : undefined} compact />
          <KpiCard label="LINE友達"       value={String(s.line_stats.friends_count)}          badge={s.line_stats.friends_count > 0 ? "green" : undefined}  compact />
          <KpiCard label="LINE連携顧客"   value={String(s.line_stats.linked_count)}           badge={s.line_stats.linked_count > 0 ? "green" : undefined}   compact />
          <KpiCard label="7日以内メンテ" value={String(s.maintenance_stats.next_7_days)}     badge={s.maintenance_stats.next_7_days > 0 ? "amber" : undefined} compact />
        </div>
      </div>
    </div>
  );
}
