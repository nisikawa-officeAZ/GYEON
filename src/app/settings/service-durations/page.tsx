export const dynamic = "force-dynamic";

import MainLayout from "@/components/layout/MainLayout";
import SettingsBackControl from "@/components/settings/SettingsBackControl";
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
      <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-5">
        <SettingsBackControl href="/settings" label="設定一覧へ戻る" />

        <section className="rounded-2xl border border-[#263955] bg-[#111826]/90 p-4 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-[#31568c] bg-[#122142] text-xl text-[#73a7ff]">◴</div>
              <div>
                <p className="text-[9px] font-bold tracking-[0.2em] text-[#5f9cff]">SERVICE DURATION</p>
                <h1 className="mt-1 text-xl font-bold text-[#e8eef7]">サービス所要時間</h1>
                <p className="mt-2 max-w-3xl text-xs leading-6 text-[#70809b]">
                  施工内容ごとの標準所要時間（時間・日数）と前後のバッファを設定します。将来のカレンダー自動計算の基礎設定です（この段階では自動計算・予約への反映は行いません）。
                </p>
              </div>
            </div>
            <span className={canEdit
              ? "inline-flex min-h-8 items-center self-start rounded-full border border-emerald-700/40 bg-emerald-900/30 px-3 text-xs font-semibold text-emerald-400"
              : "inline-flex min-h-8 items-center self-start rounded-full border border-[#2a3e5d] bg-[#0b1322] px-3 text-xs font-semibold text-[#8191ad]"}
            >
              {canEdit ? "編集可能" : "閲覧のみ"}
            </span>
          </div>
        </section>

        <ServiceDurationsForm initial={durations} canEdit={canEdit} />
      </div>
    </MainLayout>
  );
}
