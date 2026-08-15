export const dynamic = "force-dynamic";

import MainLayout from "@/components/layout/MainLayout";
import { getStaffCapacitySettings } from "@/lib/dealer-settings/save-staff-capacity";
import { getStaffList } from "@/lib/staff/get-staff-list";
import { getCurrentStaff } from "@/lib/staff/get-current-staff";
import StaffCapacityForm from "./StaffCapacityForm";

export default async function StaffCapacitySettingsPage() {
  const [settings, staffList, staff] = await Promise.all([
    getStaffCapacitySettings(),
    getStaffList(),
    getCurrentStaff(),
  ]);

  const role = staff?.role ?? null;
  const canEdit = role === "owner" || role === "manager";

  // Only expose id + display name to the client (dealer-scoped list).
  const staffOptions = staffList
    .filter((s) => s.status !== "disabled")
    .map((s) => ({ id: s.id, name: s.name || s.email || s.id.slice(0, 8) }));

  return (
    <MainLayout>
      <div className="max-w-3xl mx-auto p-6 flex flex-col gap-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-lg font-semibold text-slate-100">スタッフ・キャパシティ設定</h1>
          <p className="text-xs text-slate-500">
            技術者ごとの受入可否、作業ベイ、同時対応台数、並行作業・重複警告・手動上書きのルールを設定します。
          </p>
        </div>
        <StaffCapacityForm initial={settings} staffOptions={staffOptions} canEdit={canEdit} />
      </div>
    </MainLayout>
  );
}
