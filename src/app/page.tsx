import { redirect }           from "next/navigation";
import MainLayout             from "@/components/layout/MainLayout";
import { getDashboardSummary } from "@/lib/dashboard/get-dashboard-summary";
import type { DashboardSummary, UpcomingWorkOrder } from "@/lib/dashboard/get-dashboard-summary";
import { getCurrentPlan }     from "@/lib/plans/get-current-plan";
import type { DealerPlanInfo } from "@/lib/plans/plan-types";
import { getCurrentDealer }   from "@/lib/auth/get-current-dealer";
import { createClient }       from "@/lib/supabase/server";
import OnboardingCard         from "@/components/onboarding/OnboardingCard";

// PHASE66-B: Branded dashboard components
import GyeonHero             from "@/components/dashboard/GyeonHero";
import DashboardKpiCards     from "@/components/dashboard/DashboardKpiCards";
import QuickActionsCard      from "@/components/dashboard/QuickActionsCard";
import TodayReservationsCard from "@/components/dashboard/TodayReservationsCard";
import MaintenanceDueCard    from "@/components/dashboard/MaintenanceDueCard";
import RecentActivityCard    from "@/components/dashboard/RecentActivityCard";
import StatusSummaryPanel    from "@/components/dashboard/StatusSummaryPanel";

export const metadata = { title: "Dashboard | GYEON Detailer Agent" };

// ─── Safe fallback values ─────────────────────────────────────────────────────
// Used when Supabase is unreachable, migrations not yet applied, or no dealer session.
// Hero and QuickActions always render; data sections show zeros/empty.

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
  plan:                "basic",
  subscription_status: "trial",
  started_at:          null,
  expired_at:          null,
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  // ── Onboarding redirect check ──────────────────────────────────────────────
  let shouldRedirectToOnboarding = false;
  try {
    const dealer = await getCurrentDealer();
    if (dealer) {
      const supabase = await createClient();
      const { data: settings, error } = await supabase
        .from("dealer_settings")
        .select("onboarding_completed, onboarding_step")
        .eq("dealer_id", dealer.dealer_id)
        .maybeSingle();

      if (!error) {
        const step      = (settings?.onboarding_step) ?? 1;
        const completed = (settings?.onboarding_completed) ?? false;
        if (!settings || (!completed && step === 1)) {
          shouldRedirectToOnboarding = true;
        }
      }
    }
  } catch {
    // Migration not applied or column missing — skip redirect silently
  }

  if (shouldRedirectToOnboarding) {
    redirect("/onboarding");
  }

  // ── Dashboard data — never crashes the page ────────────────────────────────
  // getDashboardSummary() returns null when the dealer session is absent.
  // Either null or a thrown error (e.g. migration not yet applied, DB unreachable)
  // both fall back to EMPTY_SUMMARY so Hero + QuickActions always render.

  let summary:  DashboardSummary = EMPTY_SUMMARY;
  let planInfo: DealerPlanInfo   = EMPTY_PLAN;
  let dataError = false;

  try {
    const [rawSummary, rawPlan] = await Promise.all([
      getDashboardSummary(),
      getCurrentPlan(),
    ]);
    if (rawSummary) {
      summary  = rawSummary;
      planInfo = rawPlan;
    } else {
      // Dealer not found / not logged in — safe zeros shown
      dataError = true;
      console.error("[Dashboard] getDashboardSummary() returned null — dealer session may be missing or DB unavailable");
    }
  } catch (e) {
    dataError = true;
    console.error("[Dashboard] Failed to load dashboard data:", e);
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <MainLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">

        {/* Onboarding progress card — hidden when completed */}
        <OnboardingCard />

        {/* ── GYEON Hero — always rendered ─────────────────────────────────── */}
        <GyeonHero />

        {/* Data unavailability notice — non-blocking */}
        {dataError && (
          <div className="mb-6 flex items-center gap-3 px-4 py-3 rounded-xl border border-amber-700/40 bg-amber-950/20">
            <span className="text-amber-400 shrink-0">⚠</span>
            <p className="text-xs text-amber-300">
              ダッシュボードデータを取得できませんでした。Supabase接続またはマイグレーションを確認してください。
              集計値はすべてゼロで表示しています。
            </p>
          </div>
        )}

        {/* ── KPI Cards ────────────────────────────────────────────────────── */}
        <div className="mb-6">
          <DashboardKpiCards summary={summary} today={today} planInfo={planInfo} />
        </div>

        {/* ── Quick Actions — always rendered ──────────────────────────────── */}
        <div className="mb-6">
          <QuickActionsCard />
        </div>

        {/* ── Status panels: Estimates / Work Orders / Invoices ────────────── */}
        <div className="mb-6">
          <StatusSummaryPanel
            estimates={summary.estimates}
            workOrders={summary.work_orders}
            invoices={summary.invoices}
          />
        </div>

        {/* ── Today Schedule ───────────────────────────────────────────────── */}
        <div className="mb-6">
          <TodayReservationsCard
            items={summary.today_work_orders}
            reservationToday={summary.reservation_stats.today}
          />
        </div>

        {/* ── Maintenance + Recent Activity (2-col on desktop) ─────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <MaintenanceDueCard
            maintenance={summary.maintenance_stats}
            lineStats={summary.line_stats}
          />
          <RecentActivityCard activities={summary.recent_activities} />
        </div>

        {/* ── Upcoming 7 days ──────────────────────────────────────────────── */}
        <UpcomingWorkOrdersPanel items={summary.upcoming_work_orders} />

      </div>
    </MainLayout>
  );
}

// ─── Upcoming work orders panel (inline, no separate file needed) ─────────────

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso.slice(0, 10);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
}

function fmtTime(iso: string | null): string {
  if (!iso) return "—";
  return iso.replace("T", " ").slice(11, 16);
}

function upcomingCustName(wo: UpcomingWorkOrder): string {
  if (!wo.customers) return "—";
  return [wo.customers.last_name, wo.customers.first_name].filter(Boolean).join(" ") || "—";
}

const WO_BADGE: Record<string, string> = {
  scheduled:   "bg-blue-600/80 text-blue-100",
  in_progress: "bg-amber-600 text-white",
};
const WO_LABEL: Record<string, string> = {
  scheduled:   "予定",
  in_progress: "施工中",
};

function UpcomingWorkOrdersPanel({ items }: { items: UpcomingWorkOrder[] }) {
  if (items.length === 0) return null;
  return (
    <div className="rounded-xl border border-slate-800 bg-[#0a0f1a] overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-800 bg-[#0f172a] flex items-center justify-between">
        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">今後7日間の施工予定</span>
        <span className="text-[10px] text-slate-600">{items.length}件</span>
      </div>
      <div className="flex flex-col divide-y divide-slate-800/40">
        {items.map(wo => (
          <div key={wo.id} className="flex items-start gap-3 px-5 py-3">
            <div className="text-right shrink-0 w-20">
              <p className="text-xs text-slate-400">
                {wo.scheduled_start_at ? fmtDate(wo.scheduled_start_at) : "—"}
              </p>
              <p className="text-[10px] text-slate-600">
                {wo.scheduled_start_at ? fmtTime(wo.scheduled_start_at) : ""}
              </p>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${WO_BADGE[wo.status] ?? "bg-slate-700 text-slate-400"}`}>
                  {WO_LABEL[wo.status] ?? wo.status}
                </span>
                <p className="text-xs text-slate-200 truncate">{upcomingCustName(wo)}</p>
              </div>
              {wo.vehicles && (
                <p className="text-[10px] text-slate-500 truncate">
                  {[wo.vehicles.maker, wo.vehicles.model].filter(Boolean).join(" ")}
                  {wo.title && ` · ${wo.title}`}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
