// GYEON Business Hub — Unified Settings Center: Platform Integration (Sprint 12F)
//
// Declares compatibility and integration metadata between the Unified Settings Center
// and the 8 platform modules it integrates with.
//
// Platform modules that integrate with the Settings Center:
//   1. Platform Core     (dealer_settings — store identity, hours, staff)
//   2. Organization      (multi-dealer hierarchy — Sprint 13+)
//   3. Subscription      (plan & billing — SubscriptionCenter)
//   4. Communication     (LINE, WhatsApp, Email, SMS — CommunicationCenter)
//   5. Automation        (workflows, triggers — AutomationCenter)
//   6. Analytics         (dashboards, KPIs — AnalyticsCenter)
//   7. Media             (asset types, retention — MediaAssetCenter)
//   8. AI Marketplace    (provider config, agents — AIMarketplace)
//
// This file defines:
//   - SettingsPlatformModuleId — 8 integration IDs
//   - SettingsPlatformIntegration — per-module integration descriptor
//   - SETTINGS_PLATFORM_INTEGRATIONS — 8 static entries
//   - SETTINGS_CENTER_MANIFEST — module version and readiness
//
// No DB calls. No API calls. No execution. Pure metadata declarations.
// Pure — no "use server", no async, no DB calls, no external calls.

import type {
  SettingsCategoryId,
  SettingsVisibilityLevel,
  SettingsItemStatus,
} from "./settings-types";

// ─── Platform module identity ─────────────────────────────────────────────────

/**
 * SettingsPlatformModuleId — identifiers for the 8 platform modules
 * that register or consume settings from the Unified Settings Center.
 */
export type SettingsPlatformModuleId =
  | "platform_core"       // Dealer agent, dealer-settings, staff
  | "organization"        // Multi-dealer org hierarchy (Sprint 13+)
  | "subscription_center" // Plan & billing
  | "communication_center"// LINE, WhatsApp, Email, SMS
  | "automation_center"   // Automation workflows
  | "analytics_center"    // Analytics dashboards and reports
  | "media_asset_center"  // Media storage and lifecycle
  | "ai_marketplace";     // AI provider config and agent settings

// ─── Integration descriptor ───────────────────────────────────────────────────

/**
 * Integration type — how this module interacts with the Settings Center.
 *   settings_owner — module owns and manages one or more categories
 *   settings_consumer — module reads settings defined by another module
 *   bidirectional — module both owns settings and consumes others
 */
export type SettingsIntegrationType =
  | "settings_owner"
  | "settings_consumer"
  | "bidirectional";

/**
 * SettingsPlatformIntegration — metadata describing how a platform module
 * integrates with the Unified Settings Center.
 */
export interface SettingsPlatformIntegration {
  module_id:          SettingsPlatformModuleId;
  display_name:       string;
  integration_type:   SettingsIntegrationType;
  /** Categories this module owns (provides settings for). */
  owned_categories:   SettingsCategoryId[];
  /** Categories this module reads settings from. */
  consumed_categories: SettingsCategoryId[];
  /** Minimum visibility level for users of this module to see its settings. */
  min_visibility:     SettingsVisibilityLevel;
  /** Current integration status. */
  status:             SettingsItemStatus;
  /** Settings Center sub-module version. Bumped on registry changes. */
  registry_version:   string;
  /** Sprint when this integration was declared. */
  declared_since:     string;
  /** Sprint when live integration is wired. */
  wire_sprint:        string;
  /** Whether this module's settings are actively persisted today. */
  persistence_active: boolean;
}

// ─── Platform integration registry ────────────────────────────────────────────

export const SETTINGS_PLATFORM_INTEGRATIONS: SettingsPlatformIntegration[] = [
  {
    module_id:           "platform_core",
    display_name:        "Platform Core (Dealer Agent)",
    integration_type:    "settings_owner",
    owned_categories:    ["dealer", "staff", "roles_permissions", "branding", "notifications", "ocr", "pdf"],
    consumed_categories: [],
    min_visibility:      "staff",
    status:              "visible",
    registry_version:    "1.0.0",
    declared_since:      "Sprint PHASE70",
    wire_sprint:         "Sprint PHASE70 (active)",
    persistence_active:  true,
  },
  {
    module_id:           "organization",
    display_name:        "Organization (Multi-Dealer)",
    integration_type:    "settings_owner",
    owned_categories:    ["organization"],
    consumed_categories: ["dealer", "subscription"],
    min_visibility:      "company_admin",
    status:              "future",
    registry_version:    "0.1.0",
    declared_since:      "Sprint 12F",
    wire_sprint:         "Sprint 13+",
    persistence_active:  false,
  },
  {
    module_id:           "subscription_center",
    display_name:        "Subscription & Billing Center",
    integration_type:    "bidirectional",
    owned_categories:    ["subscription"],
    consumed_categories: ["dealer"],
    min_visibility:      "dealer_owner",
    status:              "visible",
    registry_version:    "1.0.0",
    declared_since:      "Sprint 12B",
    wire_sprint:         "Sprint PHASE70 (plan display active)",
    persistence_active:  true,
  },
  {
    module_id:           "communication_center",
    display_name:        "Communication Center",
    integration_type:    "settings_owner",
    owned_categories:    ["communication"],
    consumed_categories: ["dealer", "ai_providers"],
    min_visibility:      "manager",
    status:              "visible",
    registry_version:    "1.0.0",
    declared_since:      "Sprint PHASE70",
    wire_sprint:         "Sprint PHASE70 (LINE active)",
    persistence_active:  true,
  },
  {
    module_id:           "automation_center",
    display_name:        "Automation Center",
    integration_type:    "settings_owner",
    owned_categories:    ["automation"],
    consumed_categories: ["communication", "ai_marketplace", "dealer"],
    min_visibility:      "manager",
    status:              "future",
    registry_version:    "0.1.0",
    declared_since:      "Sprint 12D",
    wire_sprint:         "Sprint 13",
    persistence_active:  false,
  },
  {
    module_id:           "analytics_center",
    display_name:        "Analytics Center",
    integration_type:    "settings_owner",
    owned_categories:    ["analytics"],
    consumed_categories: ["subscription", "dealer"],
    min_visibility:      "manager",
    status:              "visible",
    registry_version:    "0.2.0",
    declared_since:      "Sprint 12",
    wire_sprint:         "Sprint 13",
    persistence_active:  false,
  },
  {
    module_id:           "media_asset_center",
    display_name:        "Media Asset Center",
    integration_type:    "settings_owner",
    owned_categories:    ["media"],
    consumed_categories: ["subscription", "ai_marketplace", "communication"],
    min_visibility:      "dealer_owner",
    status:              "future",
    registry_version:    "0.2.0",
    declared_since:      "Sprint 12E",
    wire_sprint:         "Sprint 13",
    persistence_active:  false,
  },
  {
    module_id:           "ai_marketplace",
    display_name:        "AI Marketplace",
    integration_type:    "settings_owner",
    owned_categories:    ["ai_providers", "ai_marketplace"],
    consumed_categories: ["subscription", "dealer"],
    min_visibility:      "dealer_owner",
    status:              "visible",
    registry_version:    "1.0.0",
    declared_since:      "Sprint PHASE72",
    wire_sprint:         "Sprint PHASE72 (provider config active)",
    persistence_active:  true,
  },
] as const satisfies SettingsPlatformIntegration[];

// ─── Settings Center manifest ──────────────────────────────────────────────────

/**
 * SETTINGS_CENTER_MANIFEST — top-level module identity and readiness metadata
 * for the Unified Settings Center.
 *
 * version:             Bumped on category count changes or schema changes.
 * category_count:      Total declared categories (20).
 * active_category_count: Categories currently rendered in settings UI (10).
 * module_count:        Platform modules registered (8).
 * execution_deferred:  true — no persistence, no live enforcement in Sprint 12F.
 * wire_sprint:         Sprint when runtime enforcement and persistence are connected.
 */
export const SETTINGS_CENTER_MANIFEST = {
  module_name:            "unified_settings_center",
  version:                "0.1.0" as const,
  declared_sprint:        "Sprint 12F" as const,
  wire_sprint:            "Sprint 13" as const,
  category_count:         20 as const,
  active_category_count:  10 as const,
  planned_category_count: 10 as const,
  module_count:           8 as const,
  policy_count:           8 as const,
  visibility_level_count: 6 as const,
  /** true — no runtime enforcement, no DB persistence in Sprint 12F. */
  execution_deferred:     true as const,
  description:
    "Unified Settings Center — canonical metadata registry for all GYEON platform settings. " +
    "Covers 20 categories across 7 groups, 8 platform module integrations, " +
    "6 visibility levels, and 8 governance policies. Foundation only (Sprint 12F).",
} as const;

// ─── Lookups ───────────────────────────────────────────────────────────────────

export function getPlatformIntegration(
  module_id: SettingsPlatformModuleId,
): SettingsPlatformIntegration | undefined {
  return SETTINGS_PLATFORM_INTEGRATIONS.find(m => m.module_id === module_id);
}

export function getActiveIntegrations(): SettingsPlatformIntegration[] {
  return SETTINGS_PLATFORM_INTEGRATIONS.filter(m => m.persistence_active);
}

export function getIntegrationsOwningCategory(
  category_id: SettingsCategoryId,
): SettingsPlatformIntegration[] {
  return SETTINGS_PLATFORM_INTEGRATIONS.filter(
    m => m.owned_categories.includes(category_id),
  );
}

export function getIntegrationsConsumingCategory(
  category_id: SettingsCategoryId,
): SettingsPlatformIntegration[] {
  return SETTINGS_PLATFORM_INTEGRATIONS.filter(
    m => m.consumed_categories.includes(category_id),
  );
}
