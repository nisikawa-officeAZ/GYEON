// GYEON Business Hub — Unified Settings Center (Sprint 12F)
//
// Barrel export for src/lib/settings/ — the Unified Settings Center metadata registry.
//
// The Unified Settings Center is a pure metadata layer that catalogs all settings
// across the GYEON platform. It does NOT store or mutate setting values.
//
// Module structure:
//   settings-types.ts             — core type definitions (SettingsCategory, SettingsItem, ...)
//   settings-category-registry.ts — 20 category descriptors + 7 group descriptors + 8 policies
//   settings-visibility.ts        — 6-level visibility model + access control utilities
//   settings-feature-flags.ts     — platform module setting registrations (7 modules, 30+ entries)
//   settings-navigation.ts        — navigation hierarchy, route metadata, URL map
//   settings-platform-bridge.ts   — 8 platform module integration descriptors + manifest
//
// One-way dependency rules (must not be violated):
//   settings/ → plans, staff (types only — no runtime imports)
//   settings/ MUST NOT import from automation, ai, communication, media, or subscription
//   Those modules may import from settings/ (downstream consumers)
//
// No "use server". No async. No DB calls. No external APIs.
// Pure TypeScript — safe to import in any context (server, client, edge).

// ─── Core types ───────────────────────────────────────────────────────────────

export type {
  SettingsCategoryId,
  SettingsSectionId,
  SettingsItemId,
  SettingsGroupId,
  SettingsVisibilityLevel,
  SettingsItemStatus,
  SettingsInputType,
  SettingsPolicyId,
  SettingsPolicyEnforcement,
  // Re-exported from plan-types for consumer convenience
  DealerPlan,
  AppFeature,
} from "./settings-types";

export type {
  SettingsItem,
  SettingsSection,
  SettingsCategory,
  SettingsGroup,
  SettingsPolicy,
} from "./settings-types";

// ─── Category registry ────────────────────────────────────────────────────────

export {
  SETTINGS_CATEGORY_REGISTRY,
  SETTINGS_GROUPS,
  SETTINGS_POLICIES,
  getSettingsCategory,
  getSettingsByGroup,
  getAvailableCategories,
  getPlannedCategories,
  getSettingsGroup,
  getSettingsPolicy,
  getCategoryIds,
} from "./settings-category-registry";

// ─── Visibility model ─────────────────────────────────────────────────────────

export type {
  SettingsVisibilityDescriptor,
} from "./settings-visibility";

export {
  VISIBILITY_LEVEL_ORDER,
  VISIBILITY_DESCRIPTORS,
  canViewSetting,
  canModifySetting,
  resolveVisibilityFromRole,
  getVisibilityDescriptor,
  getAccessibleLevels,
  isPlatformInternal,
} from "./settings-visibility";

// ─── Feature registration ─────────────────────────────────────────────────────

export type {
  SettingsModuleRegistration,
  SettingsRegistrationEntry,
} from "./settings-feature-flags";

export {
  SETTINGS_MODULE_REGISTRATIONS,
  getModuleRegistration,
  getRegistrationsForCategory,
  getVisibleRegistrations,
  getFutureRegistrations,
  getRegistrationsByStatus,
} from "./settings-feature-flags";

// ─── Navigation model ─────────────────────────────────────────────────────────

export type {
  SettingsNavNodeType,
  SettingsNavRoute,
  SettingsNavNode,
  SettingsNavTree,
} from "./settings-navigation";

export {
  SETTINGS_CATEGORY_ROUTES,
  getCategoryRoute,
  getActiveSettingsRoutes,
  buildBreadcrumb,
  buildSectionId,
  buildItemId,
} from "./settings-navigation";

// ─── Platform integration ─────────────────────────────────────────────────────

export type {
  SettingsPlatformModuleId,
  SettingsIntegrationType,
  SettingsPlatformIntegration,
} from "./settings-platform-bridge";

export {
  SETTINGS_PLATFORM_INTEGRATIONS,
  SETTINGS_CENTER_MANIFEST,
  getPlatformIntegration,
  getActiveIntegrations,
  getIntegrationsOwningCategory,
  getIntegrationsConsumingCategory,
} from "./settings-platform-bridge";
