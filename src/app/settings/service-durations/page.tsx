export const dynamic = "force-dynamic";

import MainLayout from "@/components/layout/MainLayout";
import { getServiceDurations } from "@/lib/dealer-settings/save-service-durations";
import { getCurrentStaff } from "@/lib/staff/get-current-staff";
import ServiceDurationsForm from "./ServiceDurationsForm";

export default async function ServiceDurationsSettingsPage() {
  const [durations, staff] = await Promise.all([
    getServiceDurations(),
    getCurrentStaff(),
  ]);

  const role = staff?.role ?? null;
  const canEdit = role === "owner" || role === "manager";

  return (
    <MainLayout>
      <div className="max-w-2xl mx-auto p-6 flex flex-col gap-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-lg font-semibold text-slate-100">サービス所要時間</h1>
          <p className="text-xs text-slate-500">
            施工内容ごとの標準所要時間（時間・日数）と前後のバッファを設定します。将来のカレンダー自動計算の基礎設定です（この段階では自動計算・予約への反映は行いません）。
          </p>
        </div>
        <ServiceDurationsForm initial={durations} canEdit={canEdit} />
      </div>
    </MainLayout>
  );
}
