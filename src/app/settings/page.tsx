import MainLayout from "@/components/layout/MainLayout";
import PageTitle from "@/components/ui/PageTitle";
import { getDocumentSequences } from "@/lib/numbering/get-document-sequences";
import { getCurrentPlan } from "@/lib/plans/get-current-plan";
import type { DealerPlanInfo } from "@/lib/plans/plan-types";
import { getCurrentStaff } from "@/lib/staff/get-current-staff";
import { getStaffList } from "@/lib/staff/get-staff-list";
import SubscriptionStatusCard from "@/components/subscription/SubscriptionStatusCard";
import { getCompanySettings } from "@/lib/company/save-company-settings";
import type { CompanySettingsFields } from "@/lib/company/save-company-settings";
import type { DocumentSequenceDB } from "@/lib/numbering/numbering-types";
import type { DealerStaffDB, DealerStaffRole } from "@/lib/staff/staff-types";
import { getCanonicalDealerSettings } from "@/lib/dealer-settings/get-canonical-dealer-settings";
import type { CanonicalDealerSettings } from "@/lib/dealer-settings/dealer-settings-types";
import SettingsCenterWrapper from "@/components/settings/SettingsCenterWrapper";
import type { CategoryId } from "@/components/settings/SettingsCategoryNav";
import { getAiSettings } from "@/lib/ai/get-ai-settings";
import type { AiSettingsView } from "@/lib/ai/ai-settings-types";
import { AI_SETTINGS_DEFAULT } from "@/lib/ai/ai-settings-types";

// Valid ?panel= values that can be deep-linked from /settings/[category] pages
const VALID_PANEL_IDS: CategoryId[] = [
  "store", "trade", "pricing", "service", "ocr",
  "line", "pdf", "reminder", "plan", "backup", "support", "ai",
];

const FALLBACK_PLAN: DealerPlanInfo = {
  plan: "basic",
  subscription_status: "active",
  started_at: null,
  expired_at: null,
};

export default async function SettingsPage({
  searchParams,
}: {
  searchParams?: Promise<{ panel?: string }>;
}) {
  let sequences: DocumentSequenceDB[] = [];
  let planInfo: DealerPlanInfo = FALLBACK_PLAN;
  let staffInfo: { role: DealerStaffRole; staffId: string | null } | null = null;
  let staffList: DealerStaffDB[] = [];
  let companySettings: CompanySettingsFields | null = null;
  let canonicalSettings: CanonicalDealerSettings | null = null;
  let aiSettings: AiSettingsView = { ...AI_SETTINGS_DEFAULT };

  try {
    [sequences, planInfo, staffInfo, staffList, companySettings, canonicalSettings, aiSettings] = await Promise.all([
      getDocumentSequences(),
      getCurrentPlan(),
      getCurrentStaff(),
      getStaffList(),
      getCompanySettings(),
      getCanonicalDealerSettings(),
      getAiSettings(),
    ]);
  } catch (err) {
    console.error("[SettingsPage] data fetch failed:", err);
    if (!canonicalSettings) canonicalSettings = await getCanonicalDealerSettings();
  }

  const resolvedSettings = canonicalSettings ?? (await getCanonicalDealerSettings());

  // Resolve ?panel= deep-link param (e.g., from /settings/[category] CTAs)
  const rawPanel = searchParams ? (await searchParams).panel : undefined;
  const defaultPanel: CategoryId | undefined =
    rawPanel && VALID_PANEL_IDS.includes(rawPanel as CategoryId)
      ? (rawPanel as CategoryId)
      : undefined;

  return (
    <MainLayout>
      <div className="max-w-3xl mx-auto p-6 flex flex-col gap-6">
        {/* Release header */}
        <div className="flex items-center justify-between px-4 py-2 bg-slate-900/60 border border-slate-800 rounded-xl">
          <span className="text-xs font-semibold text-slate-300 tracking-wide">
            GYEON Detailer Agent v1.0 Official Release
          </span>
          <span className="text-[10px] text-slate-500">Powered by GYEON Japan</span>
        </div>

        <PageTitle title="Settings" />

        <SettingsCenterWrapper
          settings={resolvedSettings}
          companySettings={companySettings}
          sequences={sequences}
          planInfo={planInfo}
          staffList={staffList}
          staffInfo={staffInfo}
          planSlot={<SubscriptionStatusCard />}
          aiSettings={aiSettings}
          defaultPanel={defaultPanel}
        />
      </div>
    </MainLayout>
  );
}
