"use client";

import { DashboardSummary, TodayWorkOrder, UpcomingWorkOrder, RecentActivity } from "@/lib/dashboard/get-dashboard-summary";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatYen(n: number) {
  if (n >= 100_000_000) return `¥${(n / 100_000_000).toFixed(1)}億`;
  if (n >= 10_000)      return `¥${Math.floor(n / 10_000).toLocaleString("ja-JP")}万`;
  return "¥" + n.toLocaleString("ja-JP");
}

function formatYenFull(n: number) {
  return "¥" + n.toLocaleString("ja-JP");
}

function formatDate(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso.slice(0, 10);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
}

function formatTime(iso: string | null): string {
  if (!iso) return "—";
  return iso.replace("T", " ").slice(11, 16);
}

function customerName(wo: { customers: { last_name: string | null; first_name: string | null } | null }): string {
  if (!wo.customers) return "—";
  return [wo.customers.last_name, wo.customers.first_name].filter(Boolean).join(" ") || "—";
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function SummaryCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: "green" | "blue" | "red" | "amber";
}) {
  const valueColor =
    accent === "green" ? "text-green-400" :
    accent === "red"   ? "text-red-400"   :
    accent === "amber" ? "text-amber-400" :
    accent === "blue"  ? "text-blue-400"  :
    "text-slate-100";

  return (
    <div className="bg-[#0f172a] border border-slate-800 rounded-xl p-5">
      <p className="text-xs text-slate-500 mb-2">{label}</p>
      <p className={`text-2xl font-bold tracking-tight ${valueColor}`}>{value}</p>
      {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
    </div>
  );
}

function StatusBar({
  items,
}: {
  items: { label: string; count: number; color: string }[];
}) {
  const total = items.reduce((s, i) => s + i.count, 0);
  return (
    <div className="flex flex-col gap-2">
      {total > 0 && (
        <div className="flex h-2 rounded-full overflow-hidden gap-px">
          {items.map((item) =>
            item.count > 0 ? (
              <div
                key={item.label}
                className={`${item.color} transition-all`}
                style={{ width: `${(item.count / total) * 100}%` }}
              />
            ) : null
          )}
        </div>
      )}
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {items.map((item) => (
          <div key={item.label} className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full ${item.color}`} />
            <span className="text-[10px] text-slate-400">{item.label}</span>
            <span className="text-[10px] font-medium text-slate-200">{item.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const WO_STATUS_BADGE: Record<string, string> = {
  scheduled:   "bg-blue-600/80 text-blue-100",
  in_progress: "bg-amber-600 text-white",
  completed:   "bg-green-600 text-white",
  cancelled:   "bg-slate-600 text-slate-300",
  on_hold:     "bg-orange-600 text-white",
};

const WO_STATUS_LABEL: Record<string, string> = {
  scheduled:   "予定",
  in_progress: "施工中",
  completed:   "完了",
  cancelled:   "キャンセル",
  on_hold:     "保留",
};

const ACTIVITY_ICON: Record<string, string> = {
  estimate:   "⊛",
  work_order: "⊟",
  invoice:    "⊝",
  payment:    "⊕",
};

const ACTIVITY_COLOR: Record<string, string> = {
  estimate:   "text-blue-400",
  work_order: "text-green-400",
  invoice:    "text-amber-400",
  payment:    "text-emerald-400",
};

// ─── Main Component ───────────────────────────────────────────────────────────

interface DashboardClientProps {
  summary: DashboardSummary;
  today:   string;
}

export default function DashboardClient({ summary: s, today }: DashboardClientProps) {
  const now = new Date(today);
  const monthLabel = `${now.getFullYear()}年${now.getMonth() + 1}月`;
  const yearLabel  = `${now.getFullYear()}年`;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-100">ダッシュボード</h1>
        <p className="text-xs text-slate-500">{formatDate(today)}</p>
      </div>

      {/* ── Top KPI cards ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          label={`${monthLabel}売上`}
          value={formatYen(s.sales.monthly_sales)}
          sub={formatYenFull(s.sales.monthly_sales)}
          accent="green"
        />
        <SummaryCard
          label={`${monthLabel}入金`}
          value={formatYen(s.sales.monthly_received)}
          sub={formatYenFull(s.sales.monthly_received)}
          accent="blue"
        />
        <SummaryCard
          label="未収金"
          value={formatYen(s.sales.outstanding)}
          sub={formatYenFull(s.sales.outstanding)}
          accent={s.sales.outstanding > 0 ? "red" : undefined}
        />
        <SummaryCard
          label={`${yearLabel}累計売上`}
          value={formatYen(s.sales.yearly_sales)}
          sub={formatYenFull(s.sales.yearly_sales)}
          accent="amber"
        />
      </div>

      {/* ── Secondary KPIs ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard label="顧客数"  value={String(s.customer_count)} />
        <SummaryCard label="車両数"  value={String(s.vehicle_count)} />
        <SummaryCard
          label="施工中"
          value={String(s.work_orders.in_progress)}
          accent={s.work_orders.in_progress > 0 ? "amber" : undefined}
        />
        <SummaryCard
          label="期限超過請求"
          value={String(s.invoices.overdue)}
          accent={s.invoices.overdue > 0 ? "red" : undefined}
        />
      </div>

      {/* ── Status section: Estimates / Work Orders / Invoices ────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

        {/* Estimates */}
        <div className="bg-[#0f172a] border border-slate-800 rounded-xl p-5">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">見積状況</h3>
          <StatusBar items={[
            { label: "下書き",   count: s.estimates.draft,    color: "bg-slate-500" },
            { label: "送付済み", count: s.estimates.sent,     color: "bg-blue-500" },
            { label: "承認",     count: s.estimates.approved, color: "bg-green-500" },
            { label: "却下",     count: s.estimates.rejected, color: "bg-red-500" },
            { label: "期限切れ", count: s.estimates.expired,  color: "bg-slate-600" },
          ]} />
        </div>

        {/* Work Orders */}
        <div className="bg-[#0f172a] border border-slate-800 rounded-xl p-5">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">施工状況</h3>
          <StatusBar items={[
            { label: "予定",     count: s.work_orders.scheduled,   color: "bg-blue-500" },
            { label: "施工中",   count: s.work_orders.in_progress, color: "bg-amber-500" },
            { label: "完了",     count: s.work_orders.completed,   color: "bg-green-500" },
            { label: "保留",     count: s.work_orders.on_hold,     color: "bg-orange-500" },
            { label: "キャンセル", count: s.work_orders.cancelled,  color: "bg-slate-600" },
          ]} />
        </div>

        {/* Invoices */}
        <div className="bg-[#0f172a] border border-slate-800 rounded-xl p-5">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">請求状況</h3>
          <StatusBar items={[
            { label: "下書き",   count: s.invoices.draft,          color: "bg-slate-500" },
            { label: "発行済み", count: s.invoices.issued,         color: "bg-blue-500" },
            { label: "一部入金", count: s.invoices.partially_paid, color: "bg-amber-500" },
            { label: "入金済み", count: s.invoices.paid,           color: "bg-green-500" },
            { label: "期限超過", count: s.invoices.overdue,        color: "bg-red-500" },
          ]} />
        </div>
      </div>

      {/* ── Today's work orders ───────────────────────────────────────────── */}
      <div className="bg-[#0f172a] border border-slate-800 rounded-xl p-5">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">
          今日の施工
          {s.today_work_orders.length > 0 && (
            <span className="ml-2 text-blue-400 normal-case font-normal">
              {s.today_work_orders.length}件
            </span>
          )}
        </h3>
        {s.today_work_orders.length === 0 ? (
          <p className="text-xs text-slate-600 text-center py-4">今日の施工予定はありません</p>
        ) : (
          <div className="flex flex-col gap-2">
            {s.today_work_orders.map((wo: TodayWorkOrder) => (
              <div key={wo.id} className="bg-[#1e293b] rounded-lg px-4 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded shrink-0 ${WO_STATUS_BADGE[wo.status] ?? "bg-slate-700 text-slate-300"}`}>
                      {WO_STATUS_LABEL[wo.status] ?? wo.status}
                    </span>
                    <p className="text-sm font-medium text-slate-100 truncate">
                      {customerName(wo)}
                    </p>
                  </div>
                  <p className="text-xs text-slate-400 truncate">
                    {wo.vehicles ? [wo.vehicles.maker, wo.vehicles.model, wo.vehicles.plate_number].filter(Boolean).join(" ") : "—"}
                    {wo.title && <span className="ml-2 text-slate-500">· {wo.title}</span>}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs text-slate-400">
                    {formatTime(wo.scheduled_start_at)}
                    {wo.scheduled_end_at && ` – ${formatTime(wo.scheduled_end_at)}`}
                  </p>
                  {wo.assigned_staff && (
                    <p className="text-[10px] text-slate-500 mt-0.5">{wo.assigned_staff}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Upcoming 7 days + Recent activities ──────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Upcoming */}
        <div className="bg-[#0f172a] border border-slate-800 rounded-xl p-5">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">今後7日間の施工予定</h3>
          {s.upcoming_work_orders.length === 0 ? (
            <p className="text-xs text-slate-600 text-center py-4">施工予定はありません</p>
          ) : (
            <div className="flex flex-col gap-2">
              {s.upcoming_work_orders.map((wo: UpcomingWorkOrder) => (
                <div key={wo.id} className="flex items-start gap-3 py-2 border-b border-slate-800 last:border-b-0">
                  <div className="text-right shrink-0 w-20">
                    <p className="text-xs text-slate-400">
                      {wo.scheduled_start_at ? formatDate(wo.scheduled_start_at) : "—"}
                    </p>
                    <p className="text-[10px] text-slate-600">
                      {wo.scheduled_start_at ? formatTime(wo.scheduled_start_at) : ""}
                    </p>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${WO_STATUS_BADGE[wo.status] ?? "bg-slate-700 text-slate-300"}`}>
                        {WO_STATUS_LABEL[wo.status] ?? wo.status}
                      </span>
                      <p className="text-xs text-slate-200 truncate">{customerName(wo)}</p>
                    </div>
                    {wo.vehicles && (
                      <p className="text-[10px] text-slate-500 mt-0.5 truncate">
                        {[wo.vehicles.maker, wo.vehicles.model].filter(Boolean).join(" ")}
                        {wo.title && ` · ${wo.title}`}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Activities */}
        <div className="bg-[#0f172a] border border-slate-800 rounded-xl p-5">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">最近の活動</h3>
          {s.recent_activities.length === 0 ? (
            <p className="text-xs text-slate-600 text-center py-4">活動履歴がありません</p>
          ) : (
            <div className="flex flex-col gap-0">
              {s.recent_activities.map((a: RecentActivity) => (
                <div key={`${a.type}-${a.id}`} className="flex items-start gap-3 py-2.5 border-b border-slate-800 last:border-b-0">
                  <span className={`text-base shrink-0 mt-0.5 ${ACTIVITY_COLOR[a.type]}`}>
                    {ACTIVITY_ICON[a.type]}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="text-xs text-slate-200 truncate">{a.label}</p>
                      <p className="text-[10px] text-slate-500 shrink-0">
                        {a.date ? formatDate(a.date) : "—"}
                      </p>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-0.5">{a.sub_label}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
