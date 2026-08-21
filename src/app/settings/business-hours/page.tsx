export const dynamic = "force-dynamic";

import Link from "next/link";
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
      <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-5">
        <div className="flex items-center gap-2 text-xs">
          <Link href="/settings" className="text-[#8191ad] transition-colors hover:text-[#c4d8ff]">
            ← 設定
          </Link>
          <span className="text-[#3b4b66]">/</span>
          <span className="text-[#c4d0e2]">営業時間・定休日</span>
        </div>

        <section className="rounded-2xl border border-[#263955] bg-[#111826]/90 p-4 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-[#31568c] bg-[#122142] text-xl text-[#73a7ff]">◷</div>
              <div>
                <p className="text-[9px] font-bold tracking-[0.2em] text-[#5f9cff]">BUSINESS HOURS</p>
                <h1 className="mt-1 text-xl font-bold text-[#e8eef7]">営業時間・定休日</h1>
                <p className="mt-2 max-w-3xl text-xs leading-6 text-[#70809b]">
                  週の営業時間、定休日、臨時休業日／臨時営業日を設定します。カレンダーに反映されます（この段階では予約の制限は行いません）。
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

        <BusinessHoursForm initial={settings} canEdit={canEdit} />
      </div>
    </MainLayout>
  );
}
