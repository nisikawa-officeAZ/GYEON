// GYEON Business Hub — Unified Settings Center: Category Registry (Sprint 12F)
//
// Static registry of all 20 settings categories across the platform.
//
// Each entry defines:
//   - Category identity (ID, display name, icon)
//   - Logical group membership (core / ai / communication / etc.)
//   - Minimum visibility level (who can see it)
//   - Plan requirement (which plan tier is needed)
//   - Module ownership (which platform module manages it)
//   - UI availability (is it rendered today)
//
// Existing SettingsCategoryNav.tsx (Sprint PHASE72) renders 12 UI categories.
// The canonical registry declares all 20 categories — 12 active, 8 planned.
// The registry is the source of truth; the UI component renders a subset.
//
// No runtime enforcement. No persistence. Metadata only.
// Pure — no "use server", no async, no DB calls, no execution.

import type {
  SettingsCategory,
  SettingsCategoryId,
  SettingsGroupId,
  SettingsGroup,
  SettingsPolicy,
  SettingsPolicyId,
} from "./settings-types";

// ─── Group registry ────────────────────────────────────────────────────────────

export const SETTINGS_GROUPS: SettingsGroup[] = [
  {
    group_id:     "core",
    display_name: "Core Settings",
    description:  "Fundamental shop identity, staff, and operational configuration.",
    category_ids: ["dealer", "organization", "staff", "roles_permissions", "branding", "notifications"],
    min_visibility: "staff",
    status:       "visible",
    order:        1,
  },
  {
    group_id:     "ai",
    display_name: "AI Settings",
    description:  "AI provider configuration, gateway management, and agent settings.",
    category_ids: ["ai_providers", "ai_marketplace"],
    min_visibility: "dealer_owner",
    status:       "visible",
    order:        2,
  },
  {
    group_id:     "communication",
    display_name: "Communication",
    description:  "Channel integrations — LINE, WhatsApp, Email, SMS.",
    category_ids: ["communication"],
    min_visibility: "manager",
    status:       "visible",
    order:        3,
  },
  {
    group_id:     "automation",
    display_name: "Automation",
    description:  "Workflow automation, triggers, and action settings.",
    category_ids: ["automation"],
    min_visibility: "manager",
    status:       "future",
    order:        4,
  },
  {
    group_id:     "analytics",
    display_name: "Analytics",
    description:  "Reporting, KPIs, and business analytics configuration.",
    category_ids: ["analytics"],
    min_visibility: "manager",
    status:       "visible",
    order:        5,
  },
  {
    group_id:     "business",
    display_name: "Business Operations",
    description:  "Subscription, media, document processing, and portal configuration.",
    category_ids: ["subscription", "media", "ocr", "pdf", "customer_portal"],
    min_visibility: "dealer_owner",
    status:       "visible",
    order:        6,
  },
  {
    group_id:     "enterprise",
    display_name: "Enterprise Applications",
    description:  "GYEON Distribution, Warehouse, CRM, and Accounting — enterprise only.",
    category_ids: ["gyeon_distribution", "warehouse", "crm", "accounting"],
    min_visibility: "company_admin",
    status:       "enterprise_only",
    order:        7,
  },
] as const satisfies SettingsGroup[];

// ─── Category registry ─────────────────────────────────────────────────────────

export const SETTINGS_CATEGORY_REGISTRY: SettingsCategory[] = [

  // ── Core Group ────────────────────────────────────────────────────────────

  {
    category_id:     "dealer",
    group_id:        "core",
    display_name:    "Dealer Settings",
    display_name_ja: "店舗・スタッフ",
    description:
      "Core dealer identity and operational settings. Includes business name, address, " +
      "phone, website, logo, detailer rank, business hours, closed days, " +
      "and staff management. Persisted in dealer_settings table (PHASE70).",
    icon:            "🏪",
    min_visibility:  "staff",
    status:          "visible",
    requires_plan:   null,
    module_owner:    "dealer_agent",
    section_ids:     [
      "dealer.store_info",
      "dealer.business_hours",
      "dealer.staff",
      "dealer.document_defaults",
    ],
    ui_available:    true,
    target_sprint:   "Sprint PHASE72 (active)",
  },

  {
    category_id:     "organization",
    group_id:        "core",
    display_name:    "Organization",
    display_name_ja: "組織設定",
    description:
      "Multi-dealer organization structure. Covers company hierarchy, dealer groups, " +
      "shared settings across locations, and company-level billing aggregation. " +
      "Relevant when a company operates multiple dealer shops.",
    icon:            "🏢",
    min_visibility:  "company_admin",
    status:          "future",
    requires_plan:   "pro",
    module_owner:    "organization",
    section_ids:     [],
    ui_available:    false,
    target_sprint:   "Sprint 13+",
  },

  {
    category_id:     "staff",
    group_id:        "core",
    display_name:    "Staff",
    display_name_ja: "スタッフ管理",
    description:
      "Staff profiles, invite management, and role assignment. " +
      "Includes DealerStaffRole (owner / manager / staff / readonly) assignment " +
      "and schedule configuration. Currently rendered within the 'dealer' settings UI.",
    icon:            "👥",
    min_visibility:  "manager",
    status:          "visible",
    requires_plan:   null,
    module_owner:    "dealer_agent",
    section_ids:     ["staff.profiles", "staff.roles", "staff.schedules"],
    ui_available:    true,
    target_sprint:   "Sprint PHASE72 (active)",
  },

  {
    category_id:     "roles_permissions",
    group_id:        "core",
    display_name:    "Roles & Permissions",
    display_name_ja: "役割・権限",
    description:
      "Fine-grained role definitions and permission matrices. " +
      "Extends the base DealerStaffRole with capability-level permissions " +
      "for each platform module. Sprint 13+.",
    icon:            "🔐",
    min_visibility:  "dealer_owner",
    status:          "future",
    requires_plan:   "pro",
    module_owner:    "dealer_agent",
    section_ids:     [],
    ui_available:    false,
    target_sprint:   "Sprint 13+",
  },

  {
    category_id:     "branding",
    group_id:        "core",
    display_name:    "Branding",
    display_name_ja: "ブランディング",
    description:
      "Shop logo, color theme, watermark configuration, and dealer identity assets. " +
      "Used in completion reports, PDF documents, and the customer portal. " +
      "logo_url and stamp_url are stored in dealer_settings.",
    icon:            "🎨",
    min_visibility:  "dealer_owner",
    status:          "visible",
    requires_plan:   null,
    module_owner:    "dealer_agent",
    section_ids:     ["branding.logo", "branding.colors", "branding.documents"],
    ui_available:    true,
    target_sprint:   "Sprint PHASE72 (active)",
  },

  {
    category_id:     "notifications",
    group_id:        "core",
    display_name:    "Notifications",
    display_name_ja: "通知設定",
    description:
      "System notification preferences — in-app alerts, email digests, " +
      "LINE notification forwarding, and maintenance reminder template configuration. " +
      "maintenance_reminder_templates stored in dealer_settings (PHASE70).",
    icon:            "🔔",
    min_visibility:  "manager",
    status:          "visible",
    requires_plan:   null,
    module_owner:    "dealer_agent",
    section_ids:     ["notifications.system", "notifications.reminders", "notifications.channels"],
    ui_available:    true,
    target_sprint:   "Sprint PHASE72 (active)",
  },

  // ── AI Group ──────────────────────────────────────────────────────────────

  {
    category_id:     "ai_providers",
    group_id:        "ai",
    display_name:    "AI Providers",
    display_name_ja: "AIプロバイダー設定",
    description:
      "AI provider selection, API key management, and AI gateway configuration. " +
      "Supports OpenAI, Anthropic, and Google Gemini providers. " +
      "Requires Pro+ plan. Secrets stored in ai_settings table (never in dealer_settings). " +
      "Currently rendered via /settings/ai and AIGatewaySettings component.",
    icon:            "🤖",
    min_visibility:  "dealer_owner",
    status:          "visible",
    requires_plan:   "pro_plus",
    module_owner:    "ai_marketplace",
    section_ids:     [
      "ai_providers.gateway",
      "ai_providers.openai",
      "ai_providers.anthropic",
      "ai_providers.gemini",
      "ai_providers.budget",
    ],
    ui_available:    true,
    target_sprint:   "Sprint PHASE72 (active)",
  },

  {
    category_id:     "ai_marketplace",
    group_id:        "ai",
    display_name:    "AI Marketplace",
    display_name_ja: "AIマーケットプレイス設定",
    description:
      "AI agent configuration — marketing_agent, reputation_agent, growth_agent, " +
      "ocr_agent, review_agent, line_agent, seo_agent. " +
      "Controls per-agent enable/disable, entitlement visibility, and agent-level policies.",
    icon:            "🧠",
    min_visibility:  "dealer_owner",
    status:          "visible",
    requires_plan:   "pro_plus",
    module_owner:    "ai_marketplace",
    section_ids:     ["ai_marketplace.agents", "ai_marketplace.entitlements"],
    ui_available:    false,
    target_sprint:   "Sprint 13",
  },

  // ── Communication Group ───────────────────────────────────────────────────

  {
    category_id:     "communication",
    group_id:        "communication",
    display_name:    "Communication Center",
    display_name_ja: "コミュニケーション設定",
    description:
      "Channel integration settings for LINE, WhatsApp, Email, and SMS. " +
      "LINE channel ID, LIFF ID, webhook URL, rich menu configuration, and " +
      "LINE message header/footer templates are stored in dealer_settings (PHASE70). " +
      "Currently rendered in the 'line' settings category in SettingsCategoryNav.",
    icon:            "💬",
    min_visibility:  "manager",
    status:          "visible",
    requires_plan:   "pro_plus",
    module_owner:    "communication_center",
    section_ids:     [
      "communication.line",
      "communication.whatsapp",
      "communication.email",
      "communication.sms",
      "communication.inbox",
    ],
    ui_available:    true,
    target_sprint:   "Sprint PHASE72 (active) / Sprint 13 (WhatsApp, Email, SMS)",
  },

  // ── Automation Group ──────────────────────────────────────────────────────

  {
    category_id:     "automation",
    group_id:        "automation",
    display_name:    "Automation Center",
    display_name_ja: "オートメーション設定",
    description:
      "Automation workflow enable/disable, trigger configuration, " +
      "and global automation policy settings. " +
      "Includes consent management for AI-initiated customer communications (AUT-003).",
    icon:            "⚙️",
    min_visibility:  "manager",
    status:          "future",
    requires_plan:   "pro_plus",
    module_owner:    "automation_center",
    section_ids:     ["automation.workflows", "automation.triggers", "automation.policies"],
    ui_available:    false,
    target_sprint:   "Sprint 13",
  },

  // ── Analytics Group ───────────────────────────────────────────────────────

  {
    category_id:     "analytics",
    group_id:        "analytics",
    display_name:    "Analytics Center",
    display_name_ja: "アナリティクス設定",
    description:
      "Analytics dashboard configuration, KPI display preferences, " +
      "and reporting export settings. " +
      "Includes metric group visibility and comparison period defaults.",
    icon:            "📊",
    min_visibility:  "manager",
    status:          "visible",
    requires_plan:   "pro",
    module_owner:    "analytics_center",
    section_ids:     ["analytics.dashboard", "analytics.reports", "analytics.exports"],
    ui_available:    false,
    target_sprint:   "Sprint 13",
  },

  // ── Business Group ────────────────────────────────────────────────────────

  {
    category_id:     "subscription",
    group_id:        "business",
    display_name:    "Subscription & Billing",
    display_name_ja: "契約・プラン",
    description:
      "Current plan status, usage metrics, billing history, and plan upgrade paths. " +
      "Rendered via SubscriptionStatusCard in the settings page (PHASE72). " +
      "Billing portal and invoice downloads are deferred to Sprint 13.",
    icon:            "📋",
    min_visibility:  "dealer_owner",
    status:          "visible",
    requires_plan:   null,
    module_owner:    "subscription_center",
    section_ids:     ["subscription.plan", "subscription.billing", "subscription.usage"],
    ui_available:    true,
    target_sprint:   "Sprint PHASE72 (plan display active)",
  },

  {
    category_id:     "media",
    group_id:        "business",
    display_name:    "Media Asset Center",
    display_name_ja: "メディア設定",
    description:
      "Media storage preferences, retention policy configuration, and consent management. " +
      "Includes dealer-defined retention periods (media-policy.ts dealer_defined policy), " +
      "marketing consent defaults, and AI training exclusion settings.",
    icon:            "🖼️",
    min_visibility:  "dealer_owner",
    status:          "future",
    requires_plan:   "pro",
    module_owner:    "media_asset_center",
    section_ids:     ["media.storage", "media.retention", "media.consent"],
    ui_available:    false,
    target_sprint:   "Sprint 13",
  },

  {
    category_id:     "ocr",
    group_id:        "business",
    display_name:    "OCR",
    display_name_ja: "車検証OCR",
    description:
      "OCR processing settings for vehicle registration scanning. " +
      "ocr_enabled flag and ocr_policy (human_confirmation_required, allowed_formats, " +
      "max_file_size_mb) stored in dealer_settings (PHASE70). " +
      "Currently rendered in SettingsCategoryNav.",
    icon:            "📄",
    min_visibility:  "manager",
    status:          "visible",
    requires_plan:   null,
    module_owner:    "dealer_agent",
    section_ids:     ["ocr.policy", "ocr.formats"],
    ui_available:    true,
    target_sprint:   "Sprint PHASE72 (active)",
  },

  {
    category_id:     "pdf",
    group_id:        "business",
    display_name:    "PDF & Documents",
    display_name_ja: "PDF・書類",
    description:
      "PDF document formatting, numbering sequence configuration, tax rate, " +
      "qualified invoice number, footer text, and terms & conditions. " +
      "Stored in dealer_settings (PHASE70). Document sequences in document_sequences table.",
    icon:            "📑",
    min_visibility:  "manager",
    status:          "visible",
    requires_plan:   null,
    module_owner:    "dealer_agent",
    section_ids:     ["pdf.formatting", "pdf.numbering", "pdf.tax", "pdf.footer"],
    ui_available:    true,
    target_sprint:   "Sprint PHASE72 (active)",
  },

  {
    category_id:     "customer_portal",
    group_id:        "business",
    display_name:    "Customer Portal",
    display_name_ja: "カスタマーポータル",
    description:
      "Customer-facing portal configuration. Controls what customers can see " +
      "in their media gallery, completion reports, and service history. " +
      "Requires customer consent management integration.",
    icon:            "👤",
    min_visibility:  "dealer_owner",
    status:          "future",
    requires_plan:   "pro_plus",
    module_owner:    "dealer_agent",
    section_ids:     [],
    ui_available:    false,
    target_sprint:   "Sprint 15+",
  },

  // ── Enterprise Group ──────────────────────────────────────────────────────

  {
    category_id:     "gyeon_distribution",
    group_id:        "enterprise",
    display_name:    "GYEON Distribution",
    display_name_ja: "GYEON ディストリビューション",
    description:
      "GYEON product distribution application settings. Covers product catalog sync, " +
      "distribution order defaults, dealer tier pricing, and enterprise billing. " +
      "Requires enterprise_distribution application entitlement.",
    icon:            "📦",
    min_visibility:  "company_admin",
    status:          "enterprise_only",
    requires_plan:   "pro_plus",
    module_owner:    "gyeon_distribution",
    section_ids:     [],
    ui_available:    false,
    target_sprint:   "Sprint 15+",
  },

  {
    category_id:     "warehouse",
    group_id:        "enterprise",
    display_name:    "Warehouse",
    display_name_ja: "倉庫管理",
    description:
      "Warehouse application settings — stock locations, inventory thresholds, " +
      "and supplier configuration. Requires warehouse application entitlement.",
    icon:            "🏭",
    min_visibility:  "company_admin",
    status:          "enterprise_only",
    requires_plan:   "pro_plus",
    module_owner:    "warehouse",
    section_ids:     [],
    ui_available:    false,
    target_sprint:   "Sprint 15+",
  },

  {
    category_id:     "crm",
    group_id:        "enterprise",
    display_name:    "CRM",
    display_name_ja: "CRM設定",
    description:
      "CRM application settings — customer segmentation rules, " +
      "lead scoring weights, and pipeline stage configuration.",
    icon:            "🎯",
    min_visibility:  "company_admin",
    status:          "enterprise_only",
    requires_plan:   "pro_plus",
    module_owner:    "crm",
    section_ids:     [],
    ui_available:    false,
    target_sprint:   "Sprint 15+",
  },

  {
    category_id:     "accounting",
    group_id:        "enterprise",
    display_name:    "Accounting",
    display_name_ja: "会計設定",
    description:
      "Accounting application settings — fiscal year configuration, " +
      "chart of accounts mapping, and export format for accounting software.",
    icon:            "💼",
    min_visibility:  "company_admin",
    status:          "enterprise_only",
    requires_plan:   "pro_plus",
    module_owner:    "accounting",
    section_ids:     [],
    ui_available:    false,
    target_sprint:   "Sprint 15+",
  },

] as const satisfies SettingsCategory[];

// ─── Policy registry ───────────────────────────────────────────────────────────

export const SETTINGS_POLICIES: SettingsPolicy[] = [
  {
    policy_id:    "SPOL-001",
    display_name: "Sensitive Settings Visibility Gate",
    description:
      "Any setting with min_visibility > 'staff' must not be rendered for users " +
      "with lower visibility levels. Sensitive settings include: AI provider keys, " +
      "billing data, organization structure, and staff PII.",
    enforcement:  "strict",
    applies_to:   "all",
    target_sprint: "Sprint 13 (runtime enforcement)",
  },
  {
    policy_id:    "SPOL-002",
    display_name: "AI Provider Secrets Gate",
    description:
      "AI provider API keys and secrets require dealer_owner visibility AND pro_plus plan. " +
      "Keys must be rendered masked (input_type = 'secret'). " +
      "Raw key values must never appear in rendered HTML or client-side state.",
    enforcement:  "strict",
    applies_to:   ["ai_providers"],
    target_sprint: "Sprint PHASE72 (active)",
  },
  {
    policy_id:    "SPOL-003",
    display_name: "Enterprise Feature Gate",
    description:
      "Settings with status = 'enterprise_only' require the enterprise_distribution " +
      "or equivalent application entitlement. Not visible to standard dealers.",
    enforcement:  "strict",
    applies_to:   ["gyeon_distribution", "warehouse", "crm", "accounting"],
    target_sprint: "Sprint 15+",
  },
  {
    policy_id:    "SPOL-004",
    display_name: "Unknown Role Default Deny",
    description:
      "Any user whose role cannot be resolved must be treated as having no visibility. " +
      "Only settings with min_visibility = 'readonly' may be shown. " +
      "Prevents accidental exposure of settings to unauthenticated or unresolved users.",
    enforcement:  "strict",
    applies_to:   "all",
    target_sprint: "Sprint 13 (runtime enforcement)",
  },
  {
    policy_id:    "SPOL-005",
    display_name: "Platform Admin UI Isolation",
    description:
      "Settings with min_visibility = 'platform_admin' must never appear in " +
      "the dealer-facing settings UI. Platform admin tooling is separate.",
    enforcement:  "strict",
    applies_to:   "all",
    target_sprint: "Sprint 13 (runtime enforcement)",
  },
  {
    policy_id:    "SPOL-006",
    display_name: "Destructive Setting Confirmation",
    description:
      "Settings marked is_destructive = true must display an explicit confirmation " +
      "dialog before the value is saved. The confirmation must describe the consequence.",
    enforcement:  "strict",
    applies_to:   "all",
    target_sprint: "Sprint 13 (runtime enforcement)",
  },
  {
    policy_id:    "SPOL-007",
    display_name: "Experimental Setting Warning",
    description:
      "Settings with status = 'experimental' must render a warning badge and " +
      "advisory text explaining the setting is not recommended for production.",
    enforcement:  "advisory",
    applies_to:   "all",
    target_sprint: "Sprint 13 (runtime enforcement)",
  },
  {
    policy_id:    "SPOL-008",
    display_name: "Future Setting Placeholder",
    description:
      "Settings with status = 'future' must render as a read-only placeholder card " +
      "with a 'Coming in Sprint N' label. The input must be disabled.",
    enforcement:  "advisory",
    applies_to:   "all",
    target_sprint: "Sprint 13 (runtime enforcement)",
  },
] as const satisfies SettingsPolicy[];

// ─── Lookups ───────────────────────────────────────────────────────────────────

export function getSettingsCategory(
  category_id: SettingsCategoryId,
): SettingsCategory | undefined {
  return SETTINGS_CATEGORY_REGISTRY.find(c => c.category_id === category_id);
}

export function getSettingsByGroup(
  group_id: SettingsGroupId,
): SettingsCategory[] {
  return SETTINGS_CATEGORY_REGISTRY.filter(c => c.group_id === group_id);
}

export function getAvailableCategories(): SettingsCategory[] {
  return SETTINGS_CATEGORY_REGISTRY.filter(c => c.ui_available);
}

export function getPlannedCategories(): SettingsCategory[] {
  return SETTINGS_CATEGORY_REGISTRY.filter(c => !c.ui_available);
}

export function getSettingsGroup(
  group_id: SettingsGroupId,
): SettingsGroup | undefined {
  return SETTINGS_GROUPS.find(g => g.group_id === group_id);
}

export function getSettingsPolicy(
  policy_id: SettingsPolicyId,
): SettingsPolicy | undefined {
  return SETTINGS_POLICIES.find(p => p.policy_id === policy_id);
}

export function getCategoryIds(): SettingsCategoryId[] {
  return SETTINGS_CATEGORY_REGISTRY.map(c => c.category_id);
}
