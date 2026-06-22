// DealerOS — 売上分析ページ (PHASE73)
// Owner only. Contains ALL financial KPIs removed from the home screen.
// This data never appears on the home page.

import { redirect }           from "next/navigation";
import MainLayout             from "@/components/layout/MainLayout";
import PageTitle              from "@/components/ui/PageTitle";
import { getDashboardSummary } from "@/lib/dashboard/get-dashboard-summary";
import type { DashboardSummary } from "@/lib/dashboard/get-dashboard-summary";
import { getCurrentPlan }     from "@/lib/plans/get-current-plan";
import { getCurrentStaff }    from "@/lib/staff/get-current-staff";
import {
  planLabel,
  planBadgeColor,
  subscriptionStatusLabel,
  subscriptionStatusColor,
  type DealerPlanInfo,
} from "@/lib/plans/plan-types";
import Link from "next/link";

export const metadata = { title: "売上分析 | GYEON Detailer Agent" };

const EMPTY_SUMMARY: DashboardSummary = {
  customer_count:  0,
  vehicle_count:   0,
  estimates:       { draft: 0, sent: 0, approved: 0, rejected: 0, expired: 0 },
  work_orders:     { scheduled: 0, in_progress: 0, completed: 0, on_hold: 0, cancelled: 0 },
  invoices:        { draft: 0, issued: 0, paid: 0, partially_paid: 0, overdue: 0, cancelled: 0 },
  sales:           { monthly_sales: 0, monthly_received: 0, outstanding: 0, yearly_sales: 0 },
  line_stats:            { friends_count: 0, linked_count: 0, this_month_new: 0 },
  line_message_stats:    { this_month_sent: 0, this_month_failed: 0, total_sent: 0 },
  line_queue_stats:      { scheduled: 0, failed: 0 },
  maintenance_stats:     { this_month: 0, next_7_days: 0, pending: 0, sent_this_month: 0 },
  reservation_stats:     { today: 0, this_week: 0, this_month: 0, pending: 0, confirmed: 0 },
  today_work_orders:     [],
  upcoming_work_orders:  [],
  recent_activities:     [],
};

const EMPTY_PLAN: DealerPlanInfo = {
  plan: "basic", subscription_status: "trial", started_at: null, expired_at: null,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtYen(n: number): string {
  if (n >= 100_000_000) return `¥${(n / 100_000_000).toFixed(1)}億`;
  if (n >= 10_000)      return `¥${Math.floor(n / 10_000).toLocaleString("ja-JP")}万`;
  return "¥" + n.toLocaleString("ja-JP");
}

function fmtYenFull(n: number): string {
  return "¥" + n.toLocaleString("ja-JP");
}

const card = "bg-[#0f172a] border border-slate-800 rounded-xl p-4 flex flex-col gap-1.5";

function KpiCard({
  label, value, sub, color = "text-slate-100",
}: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className={card}>
      <p className="text-[10px] text-slate-500">{label}</p>
      <p className={`text-2xl font-bold tracking-tight ${color}`}>{value}</p>
      {sub && <p className="text-[10px] text-slate-600 truncate">{sub}</p>}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function SalesPage() {
  // Owner-only guard
  const staffInfo = await getCurrentStaff().catch(() => null);
  if (!staffInfo || staffInfo.role !== "owner") {
    redirect("/");
  }

  let summary:  DashboardSummary = EMPTY_SUMMARY;
  let planInfo: DealerPlanInfo   = EMPTY_PLAN;

  try {
    const [rawSummary, rawPlan] = await Promise.all([
      getDashboardSummary(),
      getCurrentPlan(),
    ]);
    if (rawSummary) summary = rawSummary;
    planInfo = rawPlan;
  } catch {
    // Fallback zeros
  }

  const today     = new Date();
  const monthLabel = `${today.getFullYear()}年${today.getMonth() + 1}月`;
  const yearLabel  = `${today.getFullYear()}年`;
  const s = summary.sales;
  const inv = summary.invoices;

  return (
    <MainLayout>
      <div className="max-w-3xl mx-auto px-4 py-6 flex flex-col gap-6">

        {/* Back + title */}
        <div className="flex items-center gap-3">
          <Link href="/" className="text-xs text-slate-400 hover:text-slate-100 transition-colors">
            ← ホーム
          </Link>
        </div>

        <PageTitle title="売上分析" />

        {/* Plan badge */}
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl border border-slate-800 bg-[#0f172a]">
          <span className={`inline-flex items-center px-2.5 py-1 rounded-md border text-xs font-bold tracking-wide ${planBadgeColor(planInfo.plan)}`}>
            {planLabel(planInfo.plan)}
          </span>
          <span className={`text-xs font-medium ${subscriptionStatusColor(planInfo.subscription_status)}`}>
            {subscriptionStatusLabel(planInfo.subscription_status)}
          </span>
          {planInfo.started_at && (
            <span className="text-[10px] text-slate-500 ml-auto">開始 {planInfo.started_at.slice(0, 10)}</span>
          )}
        </div>

        {/* ── 月間・年間売上 ───────────────────────────────────────────── */}
        <section className="flex flex-col gap-3">
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">売上</p>
          <div className="grid grid-cols-2 gap-3">
            <KpiCard
              label={`${monthLabel}売上`}
              value={fmtYen(s.monthly_sales)}
              sub={fmtYenFull(s.monthly_sales)}
              color="text-green-400"
            />
            <KpiCard
              label={`${yearLabel}累計売上`}
              value={fmtYen(s.yearly_sales)}
              sub={fmtYenFull(s.yearly_sales)}
              color="text-amber-400"
            />
          </div>
        </section>

        {/* ── 入金・未収金 ───────────────────────────────────────────── */}
        <section className="flex flex-col gap-3">
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">入金</p>
          <div className="grid grid-cols-2 gap-3">
            <KpiCard
              label={`${monthLabel}入金`}
              value={fmtYen(s.monthly_received)}
              sub={fmtYenFull(s.monthly_received)}
              color="text-blue-400"
            />
            <KpiCard
              label="未収金"
              value={fmtYen(s.outstanding)}
              sub={fmtYenFull(s.outstanding)}
              color={s.outstanding > 0 ? "text-red-400" : "text-slate-300"}
            />
          </div>
        </section>

        {/* ── 請求状況 ────────────────────────────────────────────────── */}
        <section className="flex flex-col gap-3">
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">請求</p>
          <div className="bg-[#0f172a] border border-slate-800 rounded-xl overflow-hidden">
            {[
              { label: "下書き",   value: inv.draft,          color: "text-slate-400" },
              { label: "発行済み", value: inv.issued,         color: "text-blue-400"  },
              { label: "一部入金", value: inv.partially_paid, color: "text-amber-400" },
              { label: "入金済み", value: inv.paid,           color: "text-green-400" },
              { label: "期限超過", value: inv.overdue,        color: "text-red-400"   },
              { label: "キャンセル", value: inv.cancelled,    color: "text-slate-600" },
            ].map(({ label, value, color }) => (
              <div key={label} className="flex items-center justify-between px-4 py-2.5 border-b border-slate-800/50 last:border-b-0">
                <p className="text-xs text-slate-400">{label}</p>
                <p className={`text-sm font-semibold ${color}`}>{value}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── 顧客・車両 ──────────────────────────────────────────────── */}
        <section className="flex flex-col gap-3">
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">顧客・車両</p>
          <div className="grid grid-cols-2 gap-3">
            <KpiCard label="顧客数" value={String(summary.customer_count)} />
            <KpiCard label="車両数" value={String(summary.vehicle_count)}  />
          </div>
        </section>

        {/* ── 見積状況 ─────────────────────────────────────────────────── */}
        <section className="flex flex-col gap-3">
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">見積</p>
          <div className="bg-[#0f172a] border border-slate-800 rounded-xl overflow-hidden">
            {[
              { label: "下書き",   value: summary.estimates.draft,    color: "text-slate-400" },
              { label: "送付済み", value: summary.estimates.sent,     color: "text-blue-400"  },
              { label: "承認",     value: summary.estimates.approved, color: "text-green-400" },
              { label: "却下",     value: summary.estimates.rejected, color: "text-red-400"   },
              { label: "期限切れ", value: summary.estimates.expired,  color: "text-slate-600" },
            ].map(({ label, value, color }) => (
              <div key={label} className="flex items-center justify-between px-4 py-2.5 border-b border-slate-800/50 last:border-b-0">
                <p className="text-xs text-slate-400">{label}</p>
                <p className={`text-sm font-semibold ${color}`}>{value}</p>
              </div>
            ))}
          </div>
        </section>

        <p className="text-[10px] text-slate-600 text-center pb-2">
          このデータはオーナーのみが閲覧できます。
        </p>

      </div>
    </MainLayout>
  );
}
