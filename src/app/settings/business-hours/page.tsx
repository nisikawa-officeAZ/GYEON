export const dynamic = "force-dynamic";

import MainLayout from "@/components/layout/MainLayout";
import { getBusinessHoursSettings } from "@/lib/dealer-settings/save-business-hours";
import { getCurrentStaff } from "@/lib/staff/get-current-staff";
import BusinessHoursForm from "./BusinessHoursForm";

export default async function BusinessHoursSettingsPage() {
  const [settings, staff] = await Promise.all([
    getBusinessHoursSettings(),
    getCurrentStaff(),
  ]);

  const role = staff?.role ?? null;
  const canEdit = role === "owner" || role === "manager";

  return (
    <MainLayout>
      <div className="max-w-2xl mx-auto p-6 flex flex-col gap-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-lg font-semibold text-slate-100">営業時間・定休日</h1>
          <p className="text-xs text-slate-500">
            週の営業時間、定休日、臨時休業日／臨時営業日を設定します。カレンダーに反映されます（この段階では予約の制限は行いません）。
          </p>
        </div>
        <BusinessHoursForm initial={settings} canEdit={canEdit} />
      </div>
    </MainLayout>
  );
}
