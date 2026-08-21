import MainLayout from "@/components/layout/MainLayout";
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
      {/* UX-1B — max-w-3xl (768px) forced a 1280–1440px screen to render one narrow
          column and convert the whole settings surface into vertical scrolling. The
          hub now uses the horizontal space it already had. */}
      <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-6">
        {/* Release header */}
        <div className="flex items-center justify-between rounded-2xl border border-[#263955] bg-[#111826]/90 px-5 py-3">
          <span className="text-xs font-semibold tracking-wide text-[#c8d3e4]">
            GYEON Detailer Agent v1.0 Official Release
          </span>
          <span className="text-[10px] tracking-[0.14em] text-[#70809b]">Powered by GYEON Japan</span>
        </div>

        {/* UX-1B — the four hardcoded rows that used to sit here (営業時間・定休日 /
            サービス所要時間 / スタッフ・キャパシティ / 見積ウィザード設定) are gone from
            this page. They were a SECOND navigation list describing the same screen
            as the hub below it, and they are now first-class cards inside the hub's
            店舗運営 and 見積・価格 groups — same routes, same reachability, one list.
            `PageTitle` went with them: the hub renders its own heading, so keeping
            both produced two competing titles on one screen. */}

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
