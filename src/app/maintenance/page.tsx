import MainLayout       from "@/components/layout/MainLayout";
import MaintenanceClient from "./MaintenanceClient";
import { getMaintenanceReminders, getMaintenanceStats } from "@/lib/maintenance/get-maintenance-reminders";

export const metadata = { title: "メンテナンス管理 | DealerOS" };

export default async function MaintenancePage() {
  const [reminders, stats] = await Promise.all([
    getMaintenanceReminders({ limit: 100 }),
    getMaintenanceStats(),
  ]);

  return (
    <MainLayout>
      <div className="max-w-7xl mx-auto p-6">
        <MaintenanceClient initialReminders={reminders} stats={stats} />
      </div>
    </MainLayout>
  );
}
