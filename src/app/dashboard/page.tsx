// Dealer Owner Dashboard — Sprint 12A
//
// Server Component. All authorization and data fetching happen server-side.
//
// Role visibility rules (ANL-002, Phase C):
//   Owner / Manager → full dashboard including OwnerRevenueSection
//   Staff / Readonly → operational dashboard, revenue section omitted entirely
//   Unknown role     → revenue hidden by default (fail-closed per ANL-007)
//
// Revenue privacy guarantee:
//   OwnerRevenueSection is rendered server-side only when canViewFinance(role)
//   passes. The revenue HTML is never included in the response for unauthorized
//   users. No client-side role check. No "use client" in OwnerRevenueSection.

import { redirect }             from "next/navigation";
import Link from "next/link";
import MainLayout               from "@/components/layout/MainLayout";
import { getCurrentDealer }     from "@/lib/auth/get-current-dealer";
import { getCurrentUser }       from "@/lib/auth/get-current-user";
import { getCurrentAdmin }      from "@/lib/admin/get-current-admin";
import { createClient }         from "@/lib/supabase/server";
import { getCurrentStaff }      from "@/lib/staff/get-current-staff";
import { getDashboardSummary }  from "@/lib/dashboard/get-dashboard-summary";
import { canViewFinance, staffRoleLabel, type DealerStaffRole } from "@/lib/staff/staff-types";
import TodayReservationsCard    from "@/components/dashboard/TodayReservationsCard";
import MaintenanceDueCard       from "@/components/dashboard/MaintenanceDueCard";
import OperationsOverview       from "@/components/dashboard/OperationsOverview";
import CommunicationOverview    from "@/components/dashboard/CommunicationOverview";
import ReviewOpportunities      from "@/components/dashboard/ReviewOpportunities";
import AIInsightPanel           from "@/components/dashboard/AIInsightPanel";
import OwnerRevenueSection      from "@/components/dashboard/OwnerRevenueSection";
import { buildDeterministicInsights } from "@/lib/ai-insights/deterministic-insights";

export const metadata = { title: "ダッシュボード | GYEON Detailer Agent" };

// Section divider label
function SectionLabel({ label }: { label: string }) {
  return (
    <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-slate-700 px-1 mt-1">
      {label}
    </p>
  );
}

// Role badge for header
function RoleBadge({ role }: { role: DealerStaffRole }) {
  const colors: Record<DealerStaffRole, string> = {
    owner:    "bg-purple-900/50 text-purple-300 border-purple-700/50",
    manager:  "bg-blue-900/50 text-blue-300 border-blue-800/50",
    staff:    "bg-slate-800 text-slate-300 border-slate-700",
    readonly: "bg-slate-900 text-slate-500 border-slate-800",
  };
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${colors[role]}`}>
      {staffRoleLabel(role)}
    </span>
  );
}

export default async function DashboardPage() {
  // ── Super Admin gate (must come first) ──────────────────────────────────────
  // Super Admins have no dealer_members record. Route them to the admin console
  // BEFORE any dealer validation so they are never trapped on /no-dealer.
  const admin = await getCurrentAdmin();
  if (admin) redirect("/admin/dashboard");

  // ── Suspension gate ─────────────────────────────────────────────────────────
  // getCurrentDealer() returns null for both "no dealer" and "suspended" states.
  // Distinguish them so suspended dealers see a clear message instead of an
  // empty dashboard, while truly unlinked users are redirected to /no-dealer.
  const dealer = await getCurrentDealer();
  if (!dealer) {
    const user = await getCurrentUser();
    if (user) {
      const supabase = await createClient();
      const { data: suspended } = await supabase
        .from("dealer_members")
        .select("dealer_id")
        .eq("user_id", user.id)
        .eq("status", "suspended")
        .maybeSingle();
      if (suspended) {
        return <SuspendedCard email={user.email ?? ""} />;
      }
    }
    redirect("/no-dealer");
  }

  // ── Server-side role resolution ─────────────────────────────────────────────
  const staffInfo = await getCurrentStaff().catch(() => null);
  const role: DealerStaffRole = staffInfo?.role ?? "staff"; // fail-closed: unknown → staff

  // ── Data fetch ──────────────────────────────────────────────────────────────
  const dash = await getDashboardSummary();

  // Revenue visibility — server-side authority only (ANL-002, Phase C)
  const showRevenue = canViewFinance(role);

  // Build deterministic AI insights — role-filtered server-side (AIP-002)
  const aiInsights = dash
    ? buildDeterministicInsights(
        {
          maintenance:    dash.maintenance_stats,
          estimates:      dash.estimates,
          line_stats:     dash.line_stats,
          invoices:       dash.invoices,
          customer_count: dash.customer_count,
        },
        role,
      )
    : [];

  // ── Today's date ────────────────────────────────────────────────────────────
  const today = new Date().toLocaleDateString("ja-JP", {
    year: "numeric", month: "long", day: "numeric", weekday: "long",
  });

  return (
    <MainLayout>
      <div className="max-w-lg mx-auto flex flex-col gap-3 px-4 pb-8 pt-4">

        {/* ── Dashboard header ───────────────────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[9px] font-bold tracking-[0.18em] text-blue-500/60 uppercase mb-0.5">
              GYEON® Detailer Agent
            </p>
            <h1 className="text-[18px] font-bold text-white leading-tight">ダッシュボード</h1>
            <p className="text-[10px] text-slate-600 mt-0.5">{today}</p>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <RoleBadge role={role} />
            <Link
              href="/"
              className="text-[10px] text-slate-600 hover:text-slate-400 transition-colors"
            >
              ← ホーム
            </Link>
          </div>
        </div>

        {/* ── Quick-status chips ─────────────────────────────────────────────── */}
        {dash && (
          <div className="flex flex-wrap gap-2">
            {[
              { label: "施工中",     value: dash.work_orders.in_progress, color: "bg-amber-950/50 text-amber-300 border-amber-900/50",  href: "/work-orders"  },
              { label: "予約 (今日)", value: dash.reservation_stats.today, color: "bg-blue-950/50 text-blue-300 border-blue-900/50",    href: "/reservations" },
              { label: "メンテ 7日", value: dash.maintenance_stats.next_7_days, color: "bg-rose-950/50 text-rose-300 border-rose-900/50", href: "/maintenance" },
              { label: "見積待ち",   value: dash.estimates.sent,           color: "bg-violet-950/50 text-violet-300 border-violet-900/50", href: "/estimates" },
            ]
              .filter(c => c.value > 0)
              .map(c => (
                <Link
                  key={c.label}
                  href={c.href}
                  className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border ${c.color}`}
                >
                  {c.label} {c.value}
                </Link>
              ))}
          </div>
        )}

        {/* ── Operations ─────────────────────────────────────────────────────── */}
        <SectionLabel label="オペレーション" />
        {dash ? (
          <OperationsOverview
            workOrders={dash.work_orders}
            estimates={dash.estimates}
            customers={dash.customer_count}
            vehicles={dash.vehicle_count}
          />
        ) : (
          <ErrorCard message="データを読み込めませんでした。" />
        )}

        {/* ── Today's schedule (reuse existing component) ────────────────────── */}
        <SectionLabel label="本日のスケジュール" />
        {dash ? (
          <TodayReservationsCard
            items={dash.today_work_orders}
            reservationToday={dash.reservation_stats.today}
          />
        ) : (
          <ErrorCard message="スケジュールを読み込めませんでした。" />
        )}

        {/* ── Maintenance (reuse existing component) ─────────────────────────── */}
        <SectionLabel label="メンテナンス機会" />
        {dash ? (
          <MaintenanceDueCard
            maintenance={dash.maintenance_stats}
            lineStats={dash.line_stats}
          />
        ) : (
          <ErrorCard message="メンテナンスデータを読み込めませんでした。" />
        )}

        {/* ── Communication ──────────────────────────────────────────────────── */}
        <SectionLabel label="コミュニケーション" />
        {dash ? (
          <CommunicationOverview
            lineStats={dash.line_stats}
            lineMessageStats={dash.line_message_stats}
            lineQueueStats={dash.line_queue_stats}
          />
        ) : (
          <ErrorCard message="コミュニケーションデータを読み込めませんでした。" />
        )}

        {/* ── Review opportunities ───────────────────────────────────────────── */}
        <SectionLabel label="レビュー機会" />
        <ReviewOpportunities />

        {/* ── Owner-only revenue section ─────────────────────────────────────── */}
        {/* Rendered server-side only when canViewFinance(role) is true.          */}
        {/* Staff and readonly users never receive this HTML in their response.   */}
        {showRevenue && dash && (
          <>
            <SectionLabel label="売上・財務" />
            <OwnerRevenueSection
              sales={dash.sales}
              invoices={dash.invoices}
              role={role as "owner" | "manager"}
            />
          </>
        )}

        {/* Privacy notice for staff — confirms revenue section is intentionally hidden */}
        {!showRevenue && (
          <div className="rounded-xl border border-slate-800/40 bg-[#0a0f1a]/50 px-4 py-3 text-center">
            <p className="text-[10px] text-slate-700">
              売上データはオーナー・マネージャーのみ閲覧できます
            </p>
          </div>
        )}

        {/* ── AI Insight Panel ───────────────────────────────────────────────── */}
        {/* Insights are role-filtered server-side before passing (AIP-002).    */}
        {/* Revenue insights only included when canViewFinance(role) is true.   */}
        <SectionLabel label="AIインサイト" />
        <AIInsightPanel
          insights={aiInsights}
          role={role}
          gateway_status="not_configured"
        />

        {/* ── Quick navigation ───────────────────────────────────────────────── */}
        <SectionLabel label="クイックアクセス" />
        <div className="grid grid-cols-3 gap-2">
          {[
            { icon: "📝", label: "見積",   href: "/estimates"    },
            { icon: "🔧", label: "作業",   href: "/work-orders"  },
            { icon: "👥", label: "顧客",   href: "/customers"    },
            { icon: "🚗", label: "車両",   href: "/vehicles"     },
            { icon: "📅", label: "予約",   href: "/reservations" },
            { icon: "⚙️", label: "設定",   href: "/settings"     },
          ].map(item => (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-col items-center gap-1.5 rounded-xl border border-slate-800 bg-[#0a0f1a] py-3 px-2 hover:border-slate-700 hover:bg-[#0d1220] transition-colors"
            >
              <span className="text-xl leading-none">{item.icon}</span>
              <span className="text-[10px] text-slate-400">{item.label}</span>
            </Link>
          ))}
        </div>

      </div>
    </MainLayout>
  );
}

// Inline error fallback — no sensitive data
function ErrorCard({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-[#0a0f1a] px-4 py-6 text-center">
      <p className="text-xs text-slate-600">{message}</p>
    </div>
  );
}

// Shown when a suspended dealer navigates directly to /dashboard.
// Renders without MainLayout (no dealer context) — standalone full-page card.
function SuspendedCard({ email }: { email: string }) {
  return (
    <div className="min-h-[100dvh] bg-[#0a0a0f] flex items-center justify-center p-4">
      <div className="w-full max-w-sm flex flex-col gap-5">
        <div className="flex items-center gap-3 justify-center">
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center"
            style={{ background: "var(--gs-blue, #4f8ef7)" }}
          >
            <span className="text-white text-xl font-black">G</span>
          </div>
          <div className="text-left">
            <p className="text-[10px] font-bold text-[#55556a] tracking-[2.5px] uppercase">GYEON</p>
            <p className="text-base font-bold text-[#f0f0f5] leading-tight">Detailer Agent</p>
          </div>
        </div>

        <div
          className="rounded-2xl border p-6 flex flex-col gap-5"
          style={{ background: "var(--gs-bg-card, #16161f)", borderColor: "rgba(239,68,68,0.25)" }}
        >
          <div className="flex flex-col items-center gap-3 text-center">
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center"
              style={{ background: "rgba(239,68,68,0.12)" }}
            >
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none"
                stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
              </svg>
            </div>
            <div>
              <h1 className="text-base font-bold text-[#f0f0f5]">アカウントが停止されています</h1>
              <p className="text-xs text-[#9999b0] mt-1">
                アカウント: <span className="text-[#f0f0f5] font-medium">{email}</span>
              </p>
            </div>
          </div>

          <div
            className="rounded-xl p-4"
            style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)" }}
          >
            <p className="text-xs text-[#9999b0] leading-relaxed">
              このアカウントは管理者によって一時停止されています。
              ご不明な点はGYEONサポートまでお問い合わせください。
            </p>
          </div>

          <a
            href="/no-dealer"
            className="w-full py-2.5 rounded-lg text-sm font-medium text-center transition-all block"
            style={{
              background: "rgba(239,68,68,0.10)",
              color:      "var(--gs-red, #ef4444)",
              border:     "1px solid rgba(239,68,68,0.20)",
            }}
          >
            詳細を確認する
          </a>
        </div>
      </div>
    </div>
  );
}
