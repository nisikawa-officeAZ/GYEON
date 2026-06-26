// GYEON Business Hub — Unified Settings Center: Feature Registration (Sprint 12F)
//
// Defines the model for platform applications to register their settings.
//
// Each application registers a SettingsModuleRegistration declaring:
//   - Which settings it exposes (by SettingsItemId)
//   - Status of each setting (visible / hidden / future / experimental / enterprise_only)
//   - Which plan and features are required
//   - What the activation roadmap looks like
//
// This is a DECLARATION interface — not a runtime registration mechanism.
// In Sprint 13, modules will call registerSettingsModule() at startup.
// In Sprint 12F, registrations are declared as static constants only.
//
// The 5 registration statuses (from spec Phase D):
//   visible       — rendered in settings UI, user can modify
//   hidden        — exists but suppressed (plan gate, feature flag)
//   future        — planned; placeholder rendered (SPOL-008)
//   experimental  — rendered with warning badge (SPOL-007)
//   enterprise_only — requires enterprise entitlement (SPOL-003)
//
// No UI logic. No runtime calls. Metadata only.
// Pure — no "use server", no async, no DB calls, no execution.

import type {
  SettingsCategoryId,
  SettingsItemStatus,
  SettingsVisibilityLevel,
  DealerPlan,
  AppFeature,
} from "./settings-types";

// ─── Module registration ──────────────────────────────────────────────────────

/**
 * SettingsModuleRegistration — a platform module's declaration of its settings.
 *
 * Each platform module (ai_marketplace, communication_center, etc.) provides one
 * SettingsModuleRegistration. The Unified Settings Center merges all registrations
 * into the canonical settings index.
 */
export interface SettingsModuleRegistration {
  /** Unique identifier for this module (matches module_owner in category registry). */
  module_id:           string;
  display_name:        string;
  /** Categories this module contributes to. */
  owned_categories:    SettingsCategoryId[];
  /** Individual setting registrations from this module. */
  settings:            SettingsRegistrationEntry[];
  /** Sprint when this registration was declared. */
  registered_since:    string;
  /** Sprint when live settings persistence will be implemented. */
  persistence_sprint:  string;
}

/**
 * SettingsRegistrationEntry — one setting declared by a module.
 *
 * Analogous to SettingsItem but without the UI-layer fields.
 * The registry merges this with the category/section metadata to build SettingsItem.
 */
export interface SettingsRegistrationEntry {
  item_id:          string;   // Unique within the module (format: "module.section.key")
  category_id:      SettingsCategoryId;
  display_name:     string;
  status:           SettingsItemStatus;
  min_visibility:   SettingsVisibilityLevel;
  requires_plan:    DealerPlan | null;
  requires_feature: AppFeature | null;
  is_destructive:   boolean;
  db_path:          string | null;  // null = not yet persisted
  target_sprint:    string;
}

// ─── Module registrations ──────────────────────────────────────────────────────

/**
 * Canonical module registrations for all platform modules.
 * Each module declares its settings here — Sprint 12F foundation.
 */
export const SETTINGS_MODULE_REGISTRATIONS: SettingsModuleRegistration[] = [

  {
    module_id:        "dealer_agent",
    display_name:     "Dealer Agent (Core)",
    owned_categories: [
      "dealer", "staff", "roles_permissions",
      "branding", "notifications", "ocr", "pdf",
    ],
    settings: [
      // Dealer — store info
      { item_id: "dealer.store_info.business_name", category_id: "dealer", display_name: "Business Name",       status: "visible",       min_visibility: "dealer_owner",  requires_plan: null, requires_feature: null,  is_destructive: false, db_path: "dealer_settings.business_name",    target_sprint: "PHASE70" },
      { item_id: "dealer.store_info.business_address", category_id: "dealer", display_name: "Address",         status: "visible",       min_visibility: "dealer_owner",  requires_plan: null, requires_feature: null,  is_destructive: false, db_path: "dealer_settings.business_address", target_sprint: "PHASE70" },
      { item_id: "dealer.store_info.logo_url",     category_id: "dealer", display_name: "Shop Logo",           status: "visible",       min_visibility: "dealer_owner",  requires_plan: null, requires_feature: null,  is_destructive: false, db_path: "dealer_settings.logo_url",         target_sprint: "PHASE70" },
      { item_id: "dealer.store_info.detailer_rank", category_id: "dealer", display_name: "Detailer Rank",      status: "visible",       min_visibility: "dealer_owner",  requires_plan: null, requires_feature: null,  is_destructive: false, db_path: "dealer_settings.detailer_rank",    target_sprint: "PHASE70" },
      // Dealer — trade
      { item_id: "dealer.trade.default_rate",      category_id: "dealer", display_name: "Default Dealer Rate", status: "visible",       min_visibility: "dealer_owner",  requires_plan: "pro", requires_feature: null, is_destructive: false, db_path: "dealer_settings.default_dealer_rate_percent", target_sprint: "PHASE70" },
      // OCR
      { item_id: "ocr.policy.enabled",             category_id: "ocr",    display_name: "OCR Enabled",         status: "visible",       min_visibility: "manager",       requires_plan: null, requires_feature: null,  is_destructive: false, db_path: "dealer_settings.ocr_enabled",      target_sprint: "PHASE70" },
      { item_id: "ocr.policy.human_confirmation",  category_id: "ocr",    display_name: "Human Confirmation",  status: "visible",       min_visibility: "manager",       requires_plan: null, requires_feature: null,  is_destructive: false, db_path: "dealer_settings.ocr_policy",       target_sprint: "PHASE70" },
      // PDF
      { item_id: "pdf.tax.tax_rate",               category_id: "pdf",    display_name: "Tax Rate",            status: "visible",       min_visibility: "dealer_owner",  requires_plan: null, requires_feature: null,  is_destructive: false, db_path: "dealer_settings.tax_rate",         target_sprint: "PHASE70" },
      { item_id: "pdf.tax.qualified_invoice_no",   category_id: "pdf",    display_name: "Qualified Invoice No",status: "visible",       min_visibility: "dealer_owner",  requires_plan: null, requires_feature: null,  is_destructive: false, db_path: "dealer_settings.qualified_invoice_number", target_sprint: "PHASE70" },
    ],
    registered_since:   "Sprint PHASE70",
    persistence_sprint: "Sprint PHASE70 (active)",
  },

  {
    module_id:        "ai_marketplace",
    display_name:     "AI Marketplace",
    owned_categories: ["ai_providers", "ai_marketplace"],
    settings: [
      { item_id: "ai_providers.gateway.provider",  category_id: "ai_providers", display_name: "AI Provider",     status: "visible",       min_visibility: "dealer_owner",  requires_plan: "pro_plus", requires_feature: "ai_gateway", is_destructive: false, db_path: "ai_settings.provider_id",          target_sprint: "PHASE72" },
      { item_id: "ai_providers.gateway.enabled",   category_id: "ai_providers", display_name: "AI Gateway",      status: "visible",       min_visibility: "dealer_owner",  requires_plan: "pro_plus", requires_feature: "ai_gateway", is_destructive: false, db_path: "ai_settings.is_enabled",           target_sprint: "PHASE72" },
      { item_id: "ai_providers.openai.api_key",    category_id: "ai_providers", display_name: "OpenAI API Key",  status: "visible",       min_visibility: "dealer_owner",  requires_plan: "pro_plus", requires_feature: "ai_gateway", is_destructive: false, db_path: "ai_settings (secrets table)",      target_sprint: "PHASE72" },
      { item_id: "ai_providers.budget.monthly_cap",category_id: "ai_providers", display_name: "Monthly Budget Cap", status: "future",    min_visibility: "dealer_owner",  requires_plan: "pro_plus", requires_feature: "ai_gateway", is_destructive: false, db_path: null,                                target_sprint: "Sprint 13" },
      { item_id: "ai_marketplace.agents.enable_marketing", category_id: "ai_marketplace", display_name: "Marketing Agent", status: "future", min_visibility: "dealer_owner", requires_plan: "pro_plus", requires_feature: "ai_marketing", is_destructive: false, db_path: null, target_sprint: "Sprint 13" },
    ],
    registered_since:   "Sprint PHASE72",
    persistence_sprint: "Sprint PHASE72 (active for provider config)",
  },

  {
    module_id:        "communication_center",
    display_name:     "Communication Center",
    owned_categories: ["communication"],
    settings: [
      { item_id: "communication.line.channel_id",   category_id: "communication", display_name: "LINE Channel ID",   status: "visible", min_visibility: "manager", requires_plan: "pro_plus", requires_feature: "line", is_destructive: false, db_path: "dealer_settings.line_channel_id",   target_sprint: "PHASE70" },
      { item_id: "communication.line.liff_id",      category_id: "communication", display_name: "LINE LIFF ID",      status: "visible", min_visibility: "manager", requires_plan: "pro_plus", requires_feature: "line", is_destructive: false, db_path: "dealer_settings.line_liff_id",      target_sprint: "PHASE70" },
      { item_id: "communication.line.msg_header",   category_id: "communication", display_name: "Message Header",    status: "visible", min_visibility: "manager", requires_plan: "pro_plus", requires_feature: "line", is_destructive: false, db_path: "dealer_settings.line_message_header", target_sprint: "PHASE70" },
      { item_id: "communication.line.msg_footer",   category_id: "communication", display_name: "Message Footer",    status: "visible", min_visibility: "manager", requires_plan: "pro_plus", requires_feature: "line", is_destructive: false, db_path: "dealer_settings.line_message_footer", target_sprint: "PHASE70" },
      { item_id: "communication.whatsapp.enabled",  category_id: "communication", display_name: "WhatsApp Channel",  status: "future",  min_visibility: "manager", requires_plan: "pro_plus", requires_feature: "line", is_destructive: false, db_path: null,                                target_sprint: "Sprint 13" },
      { item_id: "communication.email.enabled",     category_id: "communication", display_name: "Email Channel",     status: "future",  min_visibility: "manager", requires_plan: "pro_plus", requires_feature: "line", is_destructive: false, db_path: null,                                target_sprint: "Sprint 13" },
    ],
    registered_since:   "Sprint PHASE70",
    persistence_sprint: "Sprint PHASE70 (LINE active)",
  },

  {
    module_id:        "automation_center",
    display_name:     "Automation Center",
    owned_categories: ["automation"],
    settings: [
      { item_id: "automation.policies.consent_required", category_id: "automation", display_name: "Customer Consent Required",    status: "future", min_visibility: "manager",      requires_plan: "pro_plus", requires_feature: null, is_destructive: false, db_path: null, target_sprint: "Sprint 13" },
      { item_id: "automation.workflows.enable",          category_id: "automation", display_name: "Enable Automation Workflows",  status: "future", min_visibility: "dealer_owner", requires_plan: "pro_plus", requires_feature: null, is_destructive: false, db_path: null, target_sprint: "Sprint 13" },
    ],
    registered_since:   "Sprint 12D",
    persistence_sprint: "Sprint 13",
  },

  {
    module_id:        "analytics_center",
    display_name:     "Analytics Center",
    owned_categories: ["analytics"],
    settings: [
      { item_id: "analytics.dashboard.default_period", category_id: "analytics", display_name: "Default Date Range", status: "future", min_visibility: "manager", requires_plan: "pro", requires_feature: null, is_destructive: false, db_path: null, target_sprint: "Sprint 13" },
      { item_id: "analytics.exports.format",           category_id: "analytics", display_name: "Export Format",      status: "future", min_visibility: "manager", requires_plan: "pro", requires_feature: null, is_destructive: false, db_path: null, target_sprint: "Sprint 13" },
    ],
    registered_since:   "Sprint 12",
    persistence_sprint: "Sprint 13",
  },

  {
    module_id:        "subscription_center",
    display_name:     "Subscription & Billing Center",
    owned_categories: ["subscription"],
    settings: [
      { item_id: "subscription.plan.current",      category_id: "subscription", display_name: "Current Plan",        status: "visible", min_visibility: "dealer_owner", requires_plan: null, requires_feature: null, is_destructive: false, db_path: "subscriptions.plan",            target_sprint: "PHASE70" },
      { item_id: "subscription.billing.portal",    category_id: "subscription", display_name: "Billing Portal",      status: "future",  min_visibility: "dealer_owner", requires_plan: null, requires_feature: null, is_destructive: false, db_path: null,                           target_sprint: "Sprint 13" },
    ],
    registered_since:   "Sprint 12B",
    persistence_sprint: "Sprint PHASE70 (plan display active)",
  },

  {
    module_id:        "media_asset_center",
    display_name:     "Media Asset Center",
    owned_categories: ["media"],
    settings: [
      { item_id: "media.retention.default_video",  category_id: "media", display_name: "Default Video Retention",  status: "future", min_visibility: "dealer_owner", requires_plan: "pro", requires_feature: null, is_destructive: false, db_path: null, target_sprint: "Sprint 13" },
      { item_id: "media.consent.ai_training_opt",  category_id: "media", display_name: "AI Training Opt-Out",      status: "future", min_visibility: "dealer_owner", requires_plan: null, requires_feature: null, is_destructive: false, db_path: null, target_sprint: "Sprint 13" },
    ],
    registered_since:   "Sprint 12E",
    persistence_sprint: "Sprint 13",
  },

] satisfies SettingsModuleRegistration[];

// ─── Lookups ───────────────────────────────────────────────────────────────────

export function getModuleRegistration(
  module_id: string,
): SettingsModuleRegistration | undefined {
  return SETTINGS_MODULE_REGISTRATIONS.find(m => m.module_id === module_id);
}

export function getRegistrationsForCategory(
  category_id: SettingsCategoryId,
): SettingsRegistrationEntry[] {
  return SETTINGS_MODULE_REGISTRATIONS
    .filter(m => m.owned_categories.includes(category_id))
    .flatMap(m => m.settings.filter(s => s.category_id === category_id));
}

export function getVisibleRegistrations(): SettingsRegistrationEntry[] {
  return SETTINGS_MODULE_REGISTRATIONS
    .flatMap(m => m.settings.filter(s => s.status === "visible"));
}

export function getFutureRegistrations(): SettingsRegistrationEntry[] {
  return SETTINGS_MODULE_REGISTRATIONS
    .flatMap(m => m.settings.filter(s => s.status === "future"));
}

export function getRegistrationsByStatus(
  status: SettingsItemStatus,
): SettingsRegistrationEntry[] {
  return SETTINGS_MODULE_REGISTRATIONS
    .flatMap(m => m.settings.filter(s => s.status === status));
}
