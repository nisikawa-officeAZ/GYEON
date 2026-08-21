export const dynamic = "force-dynamic";

import Link from "next/link";
import MainLayout from "@/components/layout/MainLayout";
import { getStaffCapacitySettings } from "@/lib/dealer-settings/save-staff-capacity";
import { getStaffList } from "@/lib/staff/get-staff-list";
import { getCurrentStaff } from "@/lib/staff/get-current-staff";
import StaffCapacityForm from "./StaffCapacityForm";

function StaffCapacityIcon() {
  return (
    <svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="7" r="2.5" />
      <path d="M4.5 16.5c.4-3 2-4.5 4.5-4.5s4.1 1.5 4.5 4.5" />
      <path d="M16 8.5h3.5M16 12h3.5M16 15.5h3.5" />
    </svg>
  );
}

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
      <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-5">
        <div className="flex items-center gap-2 text-xs">
          <Link href="/settings" className="text-[#8191ad] transition-colors hover:text-[#c4d8ff]">
            ← 設定
          </Link>
          <span className="text-[#3b4b66]">/</span>
          <span className="text-[#c4d0e2]">スタッフ・キャパシティ</span>
        </div>

        <section className="rounded-2xl border border-[#263955] bg-[#111826]/90 p-4 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-[#31568c] bg-[#122142] text-[#73a7ff]">
                <StaffCapacityIcon />
              </div>
              <div>
                <p className="text-[9px] font-bold tracking-[0.2em] text-[#5f9cff]">STAFF CAPACITY</p>
                <h1 className="mt-1 text-xl font-bold text-[#e8eef7]">スタッフ・キャパシティ設定</h1>
                <p className="mt-2 max-w-3xl text-xs leading-6 text-[#70809b]">
                  技術者ごとの受入可否、作業ベイ、同時対応台数、並行作業・重複警告・手動上書きのルールを設定します。
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

        <StaffCapacityForm initial={settings} staffOptions={staffOptions} canEdit={canEdit} />
      </div>
    </MainLayout>
  );
}
