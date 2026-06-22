// DealerOS — Home Screen (PHASE73 iPhone-first revision)
// Layout: compact header → 4×2 icon grid → maintenance summary (max 3)
// No financial KPIs. No product promotions. No scrolling required for main actions.

import { redirect }            from "next/navigation";
import MainLayout              from "@/components/layout/MainLayout";
import { getDashboardSummary }  from "@/lib/dashboard/get-dashboard-summary";
import type { DashboardSummary } from "@/lib/dashboard/get-dashboard-summary";
import { getCurrentDealer }    from "@/lib/auth/get-current-dealer";
import { createClient }        from "@/lib/supabase/server";
import { getCompanySettings }  from "@/lib/company/save-company-settings";
import OnboardingCard          from "@/components/onboarding/OnboardingCard";
import TodayHeader             from "@/components/dashboard/TodayHeader";
import MainActionsGrid         from "@/components/dashboard/MainActionsGrid";
import Link                    from "next/link";

export const metadata = { title: "ホーム | GYEON Detailer Agent" };

// ─── Safe fallback ────────────────────────────────────────────────────────────

const EMPTY_SUMMARY: DashboardSummary = {
  customer_count:  0,
  vehicle_count:   0,
  estimates:       { draft: 0, sent: 0, approved: 0, rejected: 0, expired: 0 },
  work_orders:     { scheduled: 0, in_progress: 0, completed: 0, on_hold: 0, cancelled: 0 },
  invoices:        { draft: 0, issued: 0, paid: 0, partially_paid: 0, overdue: 0, cancelled: 0 },
  sales:           { monthly_sales: 0, monthly_received: 0, outstanding: 0, yearly_sales: 0 },
  line_stats:         { friends_count: 0, linked_count: 0, this_month_new: 0 },
  line_message_stats: { this_month_sent: 0, this_month_failed: 0, total_sent: 0 },
  line_queue_stats:   { scheduled: 0, failed: 0 },
  maintenance_stats:  { this_month: 0, next_7_days: 0, pending: 0, sent_this_month: 0 },
  reservation_stats:  { today: 0, this_week: 0, this_month: 0, pending: 0, confirmed: 0 },
  today_work_orders:    [],
  upcoming_work_orders: [],
  recent_activities:    [],
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function HomePage() {
  // ── Onboarding redirect ────────────────────────────────────────────────────
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
        const completed = settings?.onboarding_completed ?? false;
        const step      = settings?.onboarding_step      ?? 1;
        if (!settings || (!completed && step === 1)) shouldRedirectToOnboarding = true;
      }
    }
  } catch { /* column missing — skip */ }

  if (shouldRedirectToOnboarding) redirect("/onboarding");

  // ── Operational data ───────────────────────────────────────────────────────
  let summary:      DashboardSummary = EMPTY_SUMMARY;
  let businessName: string | null    = null;

  try {
    const [rawSummary, companySettings] = await Promise.all([
      getDashboardSummary(),
      getCompanySettings(),
    ]);
    if (rawSummary) summary = rawSummary;
    businessName = companySettings?.business_name ?? null;
  } catch { /* fallback to zeros */ }

  const m = summary.maintenance_stats;
  const showMaintenance = m.next_7_days > 0 || m.pending > 0;

  return (
    <MainLayout>
      {/*
        iPhone-first layout:
        - max-w-lg keeps it narrow on tablet/desktop
        - flex flex-col with gap fills vertical space naturally
        - pb-safe ensures home indicator doesn't overlap content
      */}
      <div className="max-w-lg mx-auto flex flex-col gap-4 pb-safe">

        {/* Onboarding card — only when incomplete */}
        <OnboardingCard />

        {/* ── Premium hero: car image + dealer name + operational chips ─────── */}
        <TodayHeader
          businessName={businessName}
          reservationToday={summary.reservation_stats.today}
          workOrdersInProgress={summary.work_orders.in_progress}
          maintenanceNext7Days={m.next_7_days}
          lineScheduled={summary.line_queue_stats.scheduled}
        />

        {/* ── 2×4 premium card grid — main actions ──────────────────────────── */}
        <MainActionsGrid />

        {/* ── Maintenance summary ────────────────────────────────────────────── */}
        {showMaintenance && (
          <div className="rounded-2xl border border-amber-900/30 bg-[#0f172a] overflow-hidden shadow-lg shadow-black/30">
            <div className="flex items-center justify-between px-4 py-3 border-b border-amber-900/20">
              <span className="text-[11px] font-semibold text-amber-400/80">🔔 メンテナンス通知</span>
              <Link href="/maintenance" className="text-[10px] text-slate-500 hover:text-slate-300 transition-colors">
                一覧 →
              </Link>
            </div>
            <div className="flex divide-x divide-slate-800/60">
              {m.next_7_days > 0 && (
                <div className="flex-1 flex flex-col items-center py-3.5 gap-1">
                  <span className="text-xl font-bold text-amber-400">{m.next_7_days}</span>
                  <span className="text-[10px] text-slate-500">7日以内</span>
                </div>
              )}
              {m.pending > 0 && (
                <div className="flex-1 flex flex-col items-center py-3.5 gap-1">
                  <span className="text-xl font-bold text-rose-400">{m.pending}</span>
                  <span className="text-[10px] text-slate-500">未送信</span>
                </div>
              )}
              {m.this_month > 0 && (
                <div className="flex-1 flex flex-col items-center py-3.5 gap-1">
                  <span className="text-xl font-bold text-slate-300">{m.this_month}</span>
                  <span className="text-[10px] text-slate-500">今月予定</span>
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </MainLayout>
  );
}
