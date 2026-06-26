// GYEON Business Hub — Unified Settings Center: Core Types (Sprint 12F)
//
// Defines the type model for the Unified Settings Center.
//
// The Unified Settings Center is the canonical registry of all settings that exist
// across every application in GYEON Business Hub and Detailer Agent.
//
// Relationship to existing modules:
//   src/lib/dealer-settings/  — runtime DB values for a specific dealer (PHASE70)
//   src/lib/ai-settings/      — AI gateway runtime configuration
//   src/components/settings/  — existing UI components (SettingsCategoryNav)
//   src/lib/settings/         — THIS MODULE: metadata registry (Sprint 12F)
//
// The settings registry is READ-ONLY metadata. It describes what settings exist
// and their properties. It does NOT store or mutate actual setting values.
// Persistence remains in dealer_settings DB table (dealer-settings module).
//
// Type hierarchy:
//   SettingsCategoryId    — 20 top-level categories
//   SettingsSectionId     — sections within a category
//   SettingsItemId        — individual setting items
//   SettingsGroupId       — logical groupings across categories
//   SettingsVisibilityLevel — who can see a setting (6 levels)
//   SettingsItemStatus    — lifecycle status (visible/hidden/future/experimental/enterprise)
//   SettingsPolicy        — rules governing settings behavior
//
// No persistence. No provider SDKs. No external APIs.
// Pure — no "use server", no async, no DB calls, no execution.

import type { DealerPlan, AppFeature } from "@/lib/plans/plan-types";

export type { DealerPlan, AppFeature };

// ─── Category identifier ──────────────────────────────────────────────────────

/**
 * SettingsCategoryId — 20 top-level settings categories across all GYEON applications.
 * Registry: see settings-category-registry.ts.
 */
export type SettingsCategoryId =
  | "dealer"              // Dealer profile, store information, business hours
  | "organization"        // Organization structure, company hierarchy
  | "staff"               // Staff management, profiles, schedules
  | "roles_permissions"   // Role definitions, permission matrix
  | "ai_providers"        // AI provider configuration, API keys, gateway
  | "ai_marketplace"      // AI agent settings, feature entitlements
  | "communication"       // Communication channels, LINE, WhatsApp, Email, SMS
  | "automation"          // Automation workflows, triggers, action settings
  | "analytics"           // Analytics dashboards, reporting, KPIs
  | "subscription"        // Plan, billing, invoices, usage
  | "media"               // Media Asset Center, storage, retention policies
  | "branding"            // Logo, colors, shop identity
  | "notifications"       // System notifications, alerts, reminders
  | "ocr"                 // OCR processing settings, vehicle registration
  | "pdf"                 // PDF templates, document formatting, numbering
  | "customer_portal"     // Customer-facing portal settings (future)
  | "gyeon_distribution"  // GYEON Distribution application settings
  | "warehouse"           // Warehouse application settings
  | "crm"                 // CRM application settings
  | "accounting";         // Accounting application settings

// ─── Section and item identifiers ────────────────────────────────────────────

/** Opaque string type for section IDs (category-scoped: "dealer.store_info"). */
export type SettingsSectionId = string;

/** Opaque string type for item IDs (section-scoped: "dealer.store_info.business_name"). */
export type SettingsItemId = string;

/** Logical group ID spanning multiple categories. */
export type SettingsGroupId =
  | "core"          // dealer, organization, staff, roles, branding, notifications
  | "ai"            // ai_providers, ai_marketplace
  | "communication" // communication
  | "automation"    // automation
  | "analytics"     // analytics
  | "business"      // subscription, media, ocr, pdf, customer_portal
  | "enterprise";   // gyeon_distribution, warehouse, crm, accounting

// ─── Visibility level ─────────────────────────────────────────────────────────

/**
 * SettingsVisibilityLevel — 6 authorization levels for settings access.
 *
 * Hierarchy (most privileged → least privileged):
 *   platform_admin > company_admin > dealer_owner > manager > staff > readonly
 *
 * Key rule: Unknown roles receive no access to sensitive settings.
 * "Sensitive" = any setting with visibility > staff.
 * No runtime enforcement in Sprint 12F — declaration only.
 */
export type SettingsVisibilityLevel =
  | "platform_admin"  // GYEON platform administrators — can see all settings including system
  | "company_admin"   // Company-level admins — can see company and all dealer settings
  | "dealer_owner"    // Individual dealer owner — can see all own-shop settings
  | "manager"         // Store manager — can see operational and staff settings
  | "staff"           // General staff — can see basic settings relevant to their role
  | "readonly";       // Read-only access — can view but not modify

// ─── Item status ──────────────────────────────────────────────────────────────

/**
 * SettingsItemStatus — lifecycle/availability status for a settings item.
 *
 * Applications register settings in one of 5 statuses:
 *   visible       — currently shown in UI and active
 *   hidden        — exists but suppressed (feature flag, plan gate)
 *   future        — planned but not yet implemented
 *   experimental  — available but not recommended for production use
 *   enterprise_only — requires enterprise plan or enterprise_distribution entitlement
 */
export type SettingsItemStatus =
  | "visible"
  | "hidden"
  | "future"
  | "experimental"
  | "enterprise_only";

// ─── Input type ───────────────────────────────────────────────────────────────

/**
 * SettingsInputType — the UI control type for a settings item.
 * Used to generate the correct input component in the future settings UI.
 */
export type SettingsInputType =
  | "text"        // Single-line text input
  | "textarea"    // Multi-line text
  | "toggle"      // Boolean on/off switch
  | "select"      // Single selection from a fixed option list
  | "multi_select"// Multiple selections
  | "number"      // Numeric input
  | "email"       // Email address
  | "url"         // URL
  | "secret"      // Masked text (API keys — never rendered in plaintext)
  | "json"        // Raw JSON editor
  | "color"       // Color picker
  | "file_ref"    // Reference to a stored file (logo URL, stamp URL)
  | "date"        // Date picker
  | "display";    // Read-only display (no input)

// ─── Settings item ────────────────────────────────────────────────────────────

/**
 * SettingsItem — metadata descriptor for a single configurable setting.
 *
 * Each item represents one field in the settings UI.
 * Items are registered by platform modules, not constructed manually.
 * The actual stored value lives in dealer_settings or the relevant DB table.
 */
export interface SettingsItem {
  item_id:            SettingsItemId;
  section_id:         SettingsSectionId;
  category_id:        SettingsCategoryId;
  display_name:       string;
  description:        string;
  input_type:         SettingsInputType;
  /** Minimum visibility level required to see this setting. */
  min_visibility:     SettingsVisibilityLevel;
  status:             SettingsItemStatus;
  /** Minimum plan required to configure this setting. null = available on all plans. */
  requires_plan:      DealerPlan | null;
  /** Platform feature required for this setting to be active. */
  requires_feature:   AppFeature | null;
  /** Default value serialized as string (null = no default). */
  default_value:      string | null;
  /** Whether changing this setting requires a page reload. */
  requires_reload:    boolean;
  /** Whether changing this setting has irreversible consequences. */
  is_destructive:     boolean;
  /** DB column or JSON path that stores this value. null = not yet persisted. */
  db_path:            string | null;
  /** Platform modules affected by this setting change. */
  affects_modules:    string[];
  /** Rollout sprint. */
  target_sprint:      string;
}

// ─── Settings section ─────────────────────────────────────────────────────────

/**
 * SettingsSection — a logical grouping of related settings within a category.
 *
 * Example: "dealer" category contains sections:
 *   "Store Information", "Business Hours", "Document Defaults", "Trade Settings"
 */
export interface SettingsSection {
  section_id:     SettingsSectionId;
  category_id:    SettingsCategoryId;
  display_name:   string;
  description:    string;
  min_visibility: SettingsVisibilityLevel;
  status:         SettingsItemStatus;
  /** Ordered list of item IDs registered in this section. */
  item_ids:       SettingsItemId[];
  /** Display order within the category (ascending). */
  order:          number;
  target_sprint:  string;
}

// ─── Settings category ────────────────────────────────────────────────────────

/**
 * SettingsCategory — a top-level grouping of settings sections.
 *
 * There are 20 categories in the Unified Settings Center.
 * Each category maps to a navigation card in the Settings Index.
 */
export interface SettingsCategory {
  category_id:      SettingsCategoryId;
  group_id:         SettingsGroupId;
  display_name:     string;
  display_name_ja:  string;   // Japanese label — used in dealer-facing UI
  description:      string;
  icon:             string;   // Emoji icon for the settings card
  /** Minimum visibility level to see this category. */
  min_visibility:   SettingsVisibilityLevel;
  status:           SettingsItemStatus;
  /** Minimum plan required to access this category. null = all plans. */
  requires_plan:    DealerPlan | null;
  /** The primary platform module responsible for this category's settings. */
  module_owner:     string;
  /** Ordered list of section IDs within this category. */
  section_ids:      SettingsSectionId[];
  /** Whether this category is currently rendered in the settings UI. */
  ui_available:     boolean;
  target_sprint:    string;
}

// ─── Settings group ───────────────────────────────────────────────────────────

/**
 * SettingsGroup — a logical grouping of categories for navigation tabs or sidebars.
 *
 * The Settings Index organizes categories into 7 groups:
 *   Core, AI, Communication, Automation, Analytics, Business, Enterprise.
 */
export interface SettingsGroup {
  group_id:       SettingsGroupId;
  display_name:   string;
  description:    string;
  category_ids:   SettingsCategoryId[];
  min_visibility: SettingsVisibilityLevel;
  status:         SettingsItemStatus;
  order:          number;
}

// ─── Settings policy ──────────────────────────────────────────────────────────

/**
 * SettingsPolicyId — named rules that govern settings behavior.
 */
export type SettingsPolicyId =
  | "SPOL-001"  // Sensitive settings require dealer_owner visibility minimum
  | "SPOL-002"  // AI provider secrets require dealer_owner + pro_plus plan
  | "SPOL-003"  // Enterprise settings require enterprise plan entitlement
  | "SPOL-004"  // Unknown roles receive no access to any sensitive setting
  | "SPOL-005"  // Platform admin settings are never rendered in dealer-facing UI
  | "SPOL-006"  // Destructive settings require explicit confirmation before saving
  | "SPOL-007"  // Settings marked experimental must display an advisory warning
  | "SPOL-008"; // Future settings are rendered as read-only placeholder cards

export type SettingsPolicyEnforcement = "strict" | "advisory";

export interface SettingsPolicy {
  policy_id:    SettingsPolicyId;
  display_name: string;
  description:  string;
  enforcement:  SettingsPolicyEnforcement;
  /** Category or item IDs this policy applies to. "all" = applies globally. */
  applies_to:   SettingsCategoryId[] | "all";
  target_sprint: string;
}
