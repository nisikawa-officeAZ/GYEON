import { redirect }        from "next/navigation";
import MainLayout          from "@/components/layout/MainLayout";
import DashboardClient     from "@/components/dashboard/DashboardClient";
import { getDashboardSummary } from "@/lib/dashboard/get-dashboard-summary";
import { getCurrentPlan }  from "@/lib/plans/get-current-plan";
import { getCurrentDealer } from "@/lib/auth/get-current-dealer";
import { createClient }    from "@/lib/supabase/server";
import OnboardingCard      from "@/components/onboarding/OnboardingCard";

export const metadata = { title: "Dashboard | GYEON Detailer Agent" };

export default async function DashboardPage() {
  // ── Onboarding redirect check ─────────────────────────────────────────────
  // Redirect to /onboarding only on true first login:
  //   - no dealer_settings record (never configured), OR
  //   - onboarding_step = 1 and not completed (wizard not yet opened)
  // Fails gracefully if migration 059 is not yet applied.
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
        // Redirect if: no settings record, OR step=1 and not completed
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

  // ── Main dashboard data ───────────────────────────────────────────────────
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
      <div className="max-w-7xl mx-auto p-6">
        {/* Onboarding progress card — hidden when completed */}
        <OnboardingCard />
        <DashboardClient summary={summary} today={today} planInfo={planInfo} />
      </div>
    </MainLayout>
  );
}
