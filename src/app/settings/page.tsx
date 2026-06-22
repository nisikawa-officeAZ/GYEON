import MainLayout from "@/components/layout/MainLayout";
import PageTitle from "@/components/ui/PageTitle";
import { getDocumentSequences } from "@/lib/numbering/get-document-sequences";
import DocumentSequenceSettings from "@/components/settings/DocumentSequenceSettings";
import { getCurrentPlan } from "@/lib/plans/get-current-plan";
import {
  PLAN_FEATURES,
  planLabel,
  type DealerPlanInfo,
} from "@/lib/plans/plan-types";
import { getCurrentStaff } from "@/lib/staff/get-current-staff";
import { getStaffList } from "@/lib/staff/get-staff-list";
import StaffManagement from "@/components/settings/StaffManagement";
import SubscriptionStatusCard from "@/components/subscription/SubscriptionStatusCard";
import CompanySettingsForm from "@/components/settings/CompanySettingsForm";
import { getCompanySettings } from "@/lib/company/save-company-settings";
import type { CompanySettingsFields } from "@/lib/company/save-company-settings";
import type { DocumentSequenceDB } from "@/lib/numbering/numbering-types";
import type { DealerStaffDB, DealerStaffRole } from "@/lib/staff/staff-types";
import CanonicalSettingsSkeleton from "@/components/settings/CanonicalSettingsSkeleton";
import { getCanonicalDealerSettings } from "@/lib/dealer-settings/get-canonical-dealer-settings";
import type { CanonicalDealerSettings } from "@/lib/dealer-settings/dealer-settings-types";

const FALLBACK_PLAN: DealerPlanInfo = {
  plan: "basic",
  subscription_status: "active",
  started_at: null,
  expired_at: null,
};

export default async function SettingsPage() {
  let sequences: DocumentSequenceDB[] = [];
  let planInfo: DealerPlanInfo = FALLBACK_PLAN;
  let staffInfo: { role: DealerStaffRole; staffId: string | null } | null = null;
  let staffList: DealerStaffDB[] = [];
  let companySettings: CompanySettingsFields | null = null;
  let canonicalSettings: CanonicalDealerSettings | null = null;

  try {
    [sequences, planInfo, staffInfo, staffList, companySettings, canonicalSettings] = await Promise.all([
      getDocumentSequences(),
      getCurrentPlan(),
      getCurrentStaff(),
      getStaffList(),
      getCompanySettings(),
      getCanonicalDealerSettings(),
    ]);
  } catch (err) {
    console.error("[SettingsPage] data fetch failed:", err);
    // getCanonicalDealerSettings never throws — if we get here, fetch all individually
    if (!canonicalSettings) canonicalSettings = await getCanonicalDealerSettings();
  }

  // Feature labels for display
  const featureLabels: Record<string, string> = {
    customers:           "顧客管理",
    vehicles:            "車両管理",
    estimates:           "見積作成",
    estimate_pdf:        "PDF出力",
    products:            "GYEONカタログ",
    product_orders:      "商品注文",
    work_orders:         "施工指示",
    calendar:            "カレンダー",
    completion_reports:  "完了報告",
    invoices:            "請求書",
    payments:            "入金管理",
    maintenance:         "メンテナンス通知",
    line:                "LINE連携",
    line_crm:            "LINE CRM",
    message_logs:        "メッセージログ",
    notification_queue:  "通知キュー",
    auto_notifications:  "自動通知",
  };

  const planTiers: Array<{ key: "basic" | "pro" | "pro_plus"; color: string }> = [
    { key: "basic",    color: "text-slate-300" },
    { key: "pro",      color: "text-blue-300" },
    { key: "pro_plus", color: "text-purple-300" },
  ];

  // Features unique to each tier
  const basicOnly    = PLAN_FEATURES.basic;
  const proOnly      = PLAN_FEATURES.pro.filter((f) => !PLAN_FEATURES.basic.includes(f));
  const proPlusOnly  = PLAN_FEATURES.pro_plus.filter((f) => !PLAN_FEATURES.pro.includes(f));

  const currentPlan = planInfo.plan ?? "basic";

  return (
    <MainLayout>
      <div className="max-w-3xl mx-auto p-6 flex flex-col gap-8">
        {/* ── Release header ─────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-4 py-2 bg-slate-900/60 border border-slate-800 rounded-xl">
          <span className="text-xs font-semibold text-slate-300 tracking-wide">
            GYEON Detailer Agent v1.0 Official Release
          </span>
          <span className="text-[10px] text-slate-500">Powered by GYEON Japan</span>
        </div>

        <PageTitle title="Settings" />

        {/* ── プランカード ───────────────────────────────────────────── */}
        <section className="flex flex-col gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-100">契約プラン</h2>
            <p className="text-xs text-slate-500 mt-0.5">現在の契約プランと利用可能な機能を確認できます。</p>
          </div>

          {/* Subscription status card (PHASE58) */}
          <SubscriptionStatusCard />

          {/* Feature matrix */}
          <div className="bg-[#0f172a] border border-slate-800 rounded-xl overflow-hidden">
            {/* Header row */}
            <div className="grid grid-cols-4 border-b border-slate-800">
              <div className="px-4 py-3" />
              {planTiers.map(({ key, color }) => (
                <div
                  key={key}
                  className={`px-4 py-3 text-xs font-bold tracking-wide text-center ${color} ${
                    currentPlan === key ? "bg-slate-800/60" : ""
                  }`}
                >
                  {planLabel(key)}
                  {currentPlan === key && (
                    <span className="ml-1.5 text-[9px] font-semibold bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded">
                      現在
                    </span>
                  )}
                </div>
              ))}
            </div>

            {/* Basic features — all tiers */}
            {basicOnly.map((f) => (
              <div key={f} className="grid grid-cols-4 border-b border-slate-800/50 last:border-b-0">
                <div className="px-4 py-2 text-xs text-slate-300">{featureLabels[f] ?? f}</div>
                <div className="px-4 py-2 text-xs text-center text-green-400">✓</div>
                <div className="px-4 py-2 text-xs text-center text-green-400">✓</div>
                <div className="px-4 py-2 text-xs text-center text-green-400">✓</div>
              </div>
            ))}

            {/* Pro features — Pro and Pro Plus only */}
            {proOnly.map((f) => (
              <div key={f} className="grid grid-cols-4 border-b border-slate-800/50 last:border-b-0">
                <div className="px-4 py-2 text-xs text-slate-300">{featureLabels[f] ?? f}</div>
                <div className="px-4 py-2 text-xs text-center text-slate-600">—</div>
                <div className="px-4 py-2 text-xs text-center text-green-400">✓</div>
                <div className="px-4 py-2 text-xs text-center text-green-400">✓</div>
              </div>
            ))}

            {/* Pro Plus features — Pro Plus only */}
            {proPlusOnly.map((f) => (
              <div key={f} className="grid grid-cols-4 border-b border-slate-800/50 last:border-b-0">
                <div className="px-4 py-2 text-xs text-slate-300">{featureLabels[f] ?? f}</div>
                <div className="px-4 py-2 text-xs text-center text-slate-600">—</div>
                <div className="px-4 py-2 text-xs text-center text-slate-600">—</div>
                <div className="px-4 py-2 text-xs text-center text-green-400">✓</div>
              </div>
            ))}
          </div>
        </section>

        {/* ── スタッフ管理 ──────────────────────────────────────────── */}
        {(staffInfo?.role === "owner" || staffInfo?.role === "manager") && (
          <section className="flex flex-col gap-3">
            <div>
              <h2 className="text-base font-semibold text-slate-100">スタッフ管理</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                ディーラーのスタッフメンバーとアクセス権限を管理します。
              </p>
            </div>
            <StaffManagement initialStaff={staffList} currentRole={staffInfo.role} />
          </section>
        )}

        {/* ── 自社設定 ──────────────────────────────────────────────── */}
        <section className="flex flex-col gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-100">自社設定</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              店舗・会社情報を設定します。見積書・請求書に自動反映されます。
            </p>
          </div>
          <CompanySettingsForm initialSettings={companySettings} />
        </section>

        {/* ── 番号設定 ──────────────────────────────────────────────── */}
        <section className="flex flex-col gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-100">番号設定</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              各書類の自動採番ルールを設定します。現在の採番数はリセットできません。
            </p>
          </div>
          <DocumentSequenceSettings sequences={sequences} />
        </section>

        {/* ── Canonical Settings Skeleton (PHASE72) ─────────────────── */}
        {canonicalSettings && (
          <CanonicalSettingsSkeleton settings={canonicalSettings} />
        )}
      </div>
    </MainLayout>
  );
}
