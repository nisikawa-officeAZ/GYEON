import { redirect }           from "next/navigation";
import MainLayout             from "@/components/layout/MainLayout";
import { getDashboardSummary } from "@/lib/dashboard/get-dashboard-summary";
import { getCurrentPlan }     from "@/lib/plans/get-current-plan";
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

// Status bar panel (inline — preserved from DashboardClient)
import StatusSummaryPanel from "@/components/dashboard/StatusSummaryPanel";

export const metadata = { title: "Dashboard | GYEON Detailer Agent" };

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
    // Migration not applied — skip redirect silently
  }

  if (shouldRedirectToOnboarding) {
    redirect("/onboarding");
  }

  // ── Main dashboard data ────────────────────────────────────────────────────
  const [summary, planInfo] = await Promise.all([
    getDashboardSummary(),
    getCurrentPlan(),
  ]);
  const today = new Date().toISOString().slice(0, 10);

  if (!summary) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center py-24">
          <p className="text-sm text-slate-500">ダッシュボードを読み込めませんでした</p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">

        {/* Onboarding progress card — hidden when completed */}
        <OnboardingCard />

        {/* ── GYEON Hero ──────────────────────────────────────────────────── */}
        <GyeonHero />

        {/* ── KPI Cards ───────────────────────────────────────────────────── */}
        <div className="mb-6">
          <DashboardKpiCards summary={summary} today={today} planInfo={planInfo} />
        </div>

        {/* ── Quick Actions ────────────────────────────────────────────────── */}
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

        {/* ── Today Schedule ──────────────────────────────────────────────── */}
        <div className="mb-6">
          <TodayReservationsCard
            items={summary.today_work_orders}
            reservationToday={summary.reservation_stats.today}
          />
        </div>

        {/* ── Maintenance + Recent Activity (2-col on desktop) ────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <MaintenanceDueCard
            maintenance={summary.maintenance_stats}
            lineStats={summary.line_stats}
          />
          <RecentActivityCard activities={summary.recent_activities} />
        </div>

        {/* ── Upcoming 7 days ─────────────────────────────────────────────── */}
        <UpcomingWorkOrdersPanel items={summary.upcoming_work_orders} />

      </div>
    </MainLayout>
  );
}

// ── Inline: Upcoming work orders (preserved from DashboardClient) ─────────────

import type { UpcomingWorkOrder } from "@/lib/dashboard/get-dashboard-summary";

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso.slice(0, 10);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
}

function fmtTime(iso: string | null): string {
  if (!iso) return "—";
  return iso.replace("T", " ").slice(11, 16);
}

function custName(wo: UpcomingWorkOrder): string {
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
                <p className="text-xs text-slate-200 truncate">{custName(wo)}</p>
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
