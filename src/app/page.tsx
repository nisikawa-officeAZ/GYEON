import MainLayout           from "@/components/layout/MainLayout";
import DashboardClient      from "@/components/dashboard/DashboardClient";
import { getDashboardSummary } from "@/lib/dashboard/get-dashboard-summary";
import { getCurrentPlan }   from "@/lib/plans/get-current-plan";

export const metadata = { title: "Dashboard | GYEON Detailer Agent" };

export default async function DashboardPage() {
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
        <DashboardClient summary={summary} today={today} planInfo={planInfo} />
      </div>
    </MainLayout>
  );
}
