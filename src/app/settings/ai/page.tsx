// DealerOS — AI Settings Page (Sprint 11U)
//
// Server component: loads AI settings, marketplace data, and platform-core
// feature availability. Passes serialized props to client sections.
//
// Security:
//   - dealer_id always from getCurrentDealer() inside server actions
//   - No API keys or secrets passed to any client component
//   - Feature gate enforced server-side (Pro+ required for AI Settings)
//
// Platform Core integration:
//   - Module availability checked via isModuleAvailable() from platform-core
//   - Feature discovery via discoverFeatures() from platform-core
//   - No direct Supabase calls — all data through server actions

import MainLayout from "@/components/layout/MainLayout";
import { getAISettingsProfile } from "@/lib/ai-settings/actions/get-ai-settings-profile";
import { getAiSettings }        from "@/lib/ai/get-ai-settings";
import {
  buildSettingsPlatformView,
} from "@/lib/ai-settings/settings-view-models";
import type { AISettingsPlatformView } from "@/lib/ai-settings/settings-view-models";
import { buildDefaultProfile }         from "@/lib/ai-settings/profile-builders";
import { AI_SETTINGS_PLATFORM }        from "@/lib/ai-settings/settings-profile-types";
import {
  AI_MARKETPLACE_PROVIDER_PROFILES,
  CATEGORY_CATALOG,
  PROVIDER_RECOMMENDATIONS,
} from "@/lib/ai-marketplace";
import type { AIProviderProfile }              from "@/lib/ai-marketplace";
import type { AICapabilityCategoryMetadata }   from "@/lib/ai-marketplace";
import type { AIProviderRecommendation }       from "@/lib/ai-marketplace";
import {
  discoverFeatures,
  isModuleAvailable,
  PLATFORM_CORE,
} from "@/lib/platform-core";
import AIOverviewSection           from "@/components/settings/ai/AIOverviewSection";
import ProviderStatusSection       from "@/components/settings/ai/ProviderStatusSection";
import CapabilityAssignmentSection from "@/components/settings/ai/CapabilityAssignmentSection";
import BudgetSection               from "@/components/settings/ai/BudgetSection";
import AIHealthSection             from "@/components/settings/ai/AIHealthSection";
import MarketplaceSection          from "@/components/settings/ai/MarketplaceSection";

// ─── Module availability (via Platform Core) ──────────────────────────────────

const AI_GATEWAY_MODULE_ACTIVE    = isModuleAvailable("ai_gateway");
const AI_MARKETPLACE_MODULE_READY = isModuleAvailable("ai_marketplace");

export default async function AISettingsPage() {
  // Load AI settings from server actions (dealer_id injected inside each action)
  const [profileResult, aiSettings] = await Promise.all([
    getAISettingsProfile(),
    getAiSettings(),
  ]);

  // Resolve feature gate and migration state
  const featureNotLicensed =
    !profileResult.ok && profileResult.error.code === "FEATURE_NOT_LICENSED";
  const migrationRequired =
    !profileResult.ok && profileResult.error.code === "MIGRATION_REQUIRED";

  // Use default profile when settings not yet persisted or migration pending
  const profile = profileResult.ok
    ? profileResult.value
    : buildDefaultProfile("__loading__");

  // Build view model (current_month_usd = 0 until migration 073 is applied)
  const platformView: AISettingsPlatformView = buildSettingsPlatformView(
    profile,
    aiSettings,
    0,
  );

  // Platform Core: feature discovery for dealer_agent
  const discoveryResult = discoverFeatures({ application_id: "dealer_agent" });

  // Marketplace data (static — no await)
  const providerProfiles: AIProviderProfile[]            = AI_MARKETPLACE_PROVIDER_PROFILES;
  const categories: AICapabilityCategoryMetadata[]       = CATEGORY_CATALOG;
  const recommendations: AIProviderRecommendation[]      = PROVIDER_RECOMMENDATIONS;

  // Serializable AI error code for client components
  const errorCode: string | null = profileResult.ok
    ? null
    : profileResult.error.code;

  // ── Upgrade prompt ───────────────────────────────────────────────────────────
  if (featureNotLicensed) {
    return (
      <MainLayout>
        <div className="max-w-3xl mx-auto p-6 flex flex-col gap-6">
          <div className="flex items-center gap-3">
            <a
              href="/settings"
              className="text-xs text-slate-400 hover:text-slate-200 transition-colors"
            >
              ← 設定
            </a>
            <span className="text-slate-700">/</span>
            <span className="text-xs text-slate-300">AI設定</span>
          </div>

          <div className="px-6 py-8 border border-slate-800 bg-slate-900/50 rounded-2xl text-center flex flex-col items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-blue-950/40 border border-blue-800/40 flex items-center justify-center">
              <span className="text-2xl">🤖</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-200">AI設定はPro+プランでご利用いただけます</p>
              <p className="text-xs text-slate-400 mt-1.5 leading-relaxed max-w-sm">
                AIプロバイダー設定、ケイパビリティマーケットプレイス、予算管理などのAI機能はPro+プランが必要です。
              </p>
            </div>
            <a
              href="/plans"
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors"
            >
              プランをアップグレード
            </a>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="max-w-4xl mx-auto p-6 flex flex-col gap-8">

        {/* Breadcrumb */}
        <div className="flex items-center gap-3">
          <a
            href="/settings"
            className="text-xs text-slate-400 hover:text-slate-200 transition-colors"
          >
            ← 設定
          </a>
          <span className="text-slate-700">/</span>
          <span className="text-xs text-slate-300">AI設定</span>
        </div>

        {/* Page header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-100">AI設定</h1>
            <p className="text-xs text-slate-500 mt-1">
              AIプロバイダーと機能ごとの割り当てを管理します
            </p>
          </div>
          <span className="text-[10px] text-slate-600 font-mono">
            Platform Core v{PLATFORM_CORE.version} ·{" "}
            {discoveryResult.capabilities.filter((c) => c.status === "active").length} active caps
          </span>
        </div>

        {/* §1 — Overview */}
        <AIOverviewSection
          isFullyConfigured={platformView.is_fully_configured}
          configurationIssues={platformView.configuration_issues}
          primaryProvider={platformView.default_provider}
          settingsAvailable={AI_SETTINGS_PLATFORM.settings_available}
          migrationRequired={migrationRequired}
          profileVersion={profile.profile_version}
          platformCoreVersion={PLATFORM_CORE.version}
          aiGatewayModuleActive={AI_GATEWAY_MODULE_ACTIVE}
          errorCode={errorCode}
        />

        {/* §2 — Provider Status */}
        <ProviderStatusSection
          providerCards={platformView.provider_cards}
          extensionProviders={providerProfiles.filter(
            (p) => p.marketplace_status === "marketplace_only",
          )}
          aiGatewayModuleActive={AI_GATEWAY_MODULE_ACTIVE}
        />

        {/* §3 — Capability Assignment */}
        <CapabilityAssignmentSection
          categories={categories}
          capabilityCards={platformView.capability_cards}
          availableProviders={platformView.provider_cards}
          recommendations={recommendations}
          migrationRequired={migrationRequired}
        />

        {/* §4 — Budget */}
        <BudgetSection
          budgetCard={platformView.budget_card}
          hasAnyKey={platformView.provider_cards.some((c) => c.has_key_stored)}
          migrationRequired={migrationRequired}
        />

        {/* §5 — AI Health */}
        <AIHealthSection
          healthCards={platformView.health_cards}
        />

        {/* §6 — Marketplace */}
        <MarketplaceSection
          providerProfiles={providerProfiles}
          categories={categories}
          marketplaceModuleReady={AI_MARKETPLACE_MODULE_READY}
        />

      </div>
    </MainLayout>
  );
}
