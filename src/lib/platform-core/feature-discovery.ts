// DealerOS — Platform Core: Feature Discovery (Sprint 11T Phase E)
//
// Query API for platform-level feature and capability discovery.
// Applications call these functions to determine:
//   - Which modules are available to them
//   - What capabilities each module exposes
//   - Whether a specific service is currently active
//   - The full feature set for a given application
//
// No runtime execution. No provider selection. Metadata queries only.
// This is a design-time / initialization-time discovery layer.
//
// The distinction from Dealer Agent feature gates (checkFeatureAccess):
//   checkFeatureAccess()  — dealer subscription gate (runtime, per-dealer)
//   feature-discovery.ts — platform module availability (architecture-time, per-application)
//
// Pure — no "use server", no async, no DB calls, no external calls.

import type {
  FeatureDiscoveryQuery,
  FeatureDiscoveryResult,
  ModuleManifest,
  PlatformApplication,
  PlatformApplicationId,
  PlatformCapability,
  PlatformCapabilityStatus,
  PlatformFeature,
  PlatformModuleId,
} from "./platform-types";
import {
  PLATFORM_APPLICATION_REGISTRY,
  getApplicationDescriptor,
  getAllModulesForApplication,
} from "./application-registry";
import {
  SHARED_SERVICES_REGISTRY,
  getAllCapabilities,
  getModuleManifest,
} from "./shared-services";

// ─── Platform features (derived from module capabilities) ─────────────────────

// Platform features are higher-level named features derived from module capabilities.
// They describe what a module enables for end users / applications, not how it works internally.

const PLATFORM_FEATURES: PlatformFeature[] = [
  // Authentication
  { feature_id: "user_session",           display_name: "User Session",              description: "Authenticated user session management",                module: "authentication", available_in: ["dealer_agent", "enterprise_distribution", "warehouse", "accounting", "crm"], status: "active" },
  { feature_id: "invite_onboarding",      display_name: "Invite Onboarding",         description: "Email invite flow for new users",                      module: "authentication", available_in: ["dealer_agent", "enterprise_distribution"], status: "active" },

  // Authorization
  { feature_id: "feature_gating",         display_name: "Feature Gating",            description: "Plan-based access control for application features",   module: "authorization",  available_in: ["dealer_agent"], status: "active" },
  { feature_id: "role_access_control",    display_name: "Role Access Control",        description: "Staff role-based permission checks (owner/manager/staff)", module: "authorization", available_in: ["dealer_agent"], status: "active" },

  // AI Gateway
  { feature_id: "ai_provider_routing",    display_name: "AI Provider Routing",        description: "Route AI requests to dealer-configured provider",      module: "ai_gateway",     available_in: ["dealer_agent"], status: "planned" },
  { feature_id: "ai_key_management",      display_name: "AI Key Management",          description: "Secure dealer AI provider key storage and validation", module: "ai_gateway",     available_in: ["dealer_agent"], status: "active" },
  { feature_id: "ai_budget_control",      display_name: "AI Budget Control",          description: "Monthly AI spend limits with hard/soft enforcement",   module: "ai_gateway",     available_in: ["dealer_agent"], status: "planned" },

  // AI Marketplace
  { feature_id: "capability_selection",   display_name: "Capability Selection",       description: "Per-capability AI provider selection and routing",     module: "ai_marketplace", available_in: ["dealer_agent"], status: "planned" },
  { feature_id: "provider_recommendations","display_name": "Provider Recommendations", "description": "Automated provider recommendations by mode (quality/cost/speed)", "module": "ai_marketplace", "available_in": ["dealer_agent"], "status": "active" },

  // OCR
  { feature_id: "vehicle_ocr",            display_name: "Vehicle Registration OCR",   description: "Automatic field extraction from Japanese 車検証",      module: "ocr",            available_in: ["dealer_agent"], status: "planned" },

  // LINE
  { feature_id: "line_messaging",         display_name: "LINE Messaging",             description: "Customer messaging via LINE Messaging API",            module: "line",           available_in: ["dealer_agent"], status: "planned" },
  { feature_id: "line_automation",        display_name: "LINE Automation",            description: "10-workflow LINE automation platform",                 module: "line",           available_in: ["dealer_agent"], status: "planned" },
  { feature_id: "line_rich_menu",         display_name: "LINE Rich Menu",             description: "6-button Rich Menu management (Pro+)",                 module: "line",           available_in: ["dealer_agent"], status: "active" },

  // Media
  { feature_id: "media_management",       display_name: "Media Management",           description: "Before/after photo and video lifecycle management",    module: "media",          available_in: ["dealer_agent"], status: "planned" },
  { feature_id: "ai_media_packaging",     display_name: "AI Media Packaging",         description: "Privacy-safe media packaging for AI agent use",        module: "media",          available_in: ["dealer_agent"], status: "planned" },

  // Notification
  { feature_id: "email_notification",     display_name: "Email Notification",         description: "Transactional email delivery",                         module: "notification",   available_in: ["dealer_agent", "enterprise_distribution", "accounting"], status: "planned" },
  { feature_id: "scheduled_reminders",    display_name: "Scheduled Reminders",        description: "Cron-based maintenance and billing reminders",         module: "notification",   available_in: ["dealer_agent", "enterprise_distribution"], status: "planned" },

  // PDF
  { feature_id: "estimate_pdf",           display_name: "Estimate PDF",               description: "Quote PDF generation",                                 module: "pdf",            available_in: ["dealer_agent"], status: "active" },
  { feature_id: "invoice_pdf",            display_name: "Invoice PDF",                description: "Invoice PDF generation",                               module: "pdf",            available_in: ["dealer_agent", "enterprise_distribution", "accounting"], status: "active" },
  { feature_id: "delivery_note_pdf",      display_name: "Delivery Note PDF",          description: "EDP delivery note (with / without prices)",            module: "pdf",            available_in: ["enterprise_distribution"], status: "planned" },
  { feature_id: "statement_pdf",          display_name: "Statement PDF",              description: "Monthly B2B billing statement PDF",                    module: "pdf",            available_in: ["enterprise_distribution", "accounting"], status: "planned" },

  // Analytics
  { feature_id: "growth_analytics",       display_name: "Growth Analytics",           description: "Dealer growth KPIs and AI recommendations",            module: "analytics",      available_in: ["dealer_agent"], status: "planned" },
  { feature_id: "sales_analytics",        display_name: "Sales Analytics",            description: "B2B sales by customer and salesperson",                module: "analytics",      available_in: ["enterprise_distribution"], status: "planned" },
];

// ─── Discovery functions ──────────────────────────────────────────────────────

export function discoverFeatures(
  query: FeatureDiscoveryQuery = {},
): FeatureDiscoveryResult {
  let capabilities = getAllCapabilities();
  let features     = [...PLATFORM_FEATURES];
  let modules      = [...SHARED_SERVICES_REGISTRY];

  if (query.application_id) {
    const appModules = new Set(getAllModulesForApplication(query.application_id));
    capabilities = capabilities.filter(
      (c) => appModules.has(c.module) && c.consuming_applications.includes(query.application_id!),
    );
    features = features.filter(
      (f) => appModules.has(f.module) && f.available_in.includes(query.application_id!),
    );
    modules = modules.filter((m) => appModules.has(m.module_id));
  }

  if (query.module_id) {
    capabilities = capabilities.filter((c) => c.module === query.module_id);
    features     = features.filter((f) => f.module === query.module_id);
    modules      = modules.filter((m) => m.module_id === query.module_id);
  }

  if (query.status) {
    capabilities = capabilities.filter((c) => c.status === query.status);
    features     = features.filter((f) => f.status === query.status);
    modules      = modules.filter((m) => m.status === query.status);
  }

  return {
    query,
    capabilities,
    features,
    modules,
    total_count: capabilities.length + features.length,
  };
}

export function getAvailableModules(
  application_id: PlatformApplicationId,
): ModuleManifest[] {
  const moduleIds = new Set(getAllModulesForApplication(application_id));
  return SHARED_SERVICES_REGISTRY.filter((m) => moduleIds.has(m.module_id));
}

export function getActiveCapabilitiesForApplication(
  application_id: PlatformApplicationId,
): PlatformCapability[] {
  return discoverFeatures({ application_id, status: "active" }).capabilities;
}

export function getPlannedCapabilitiesForApplication(
  application_id: PlatformApplicationId,
): PlatformCapability[] {
  return discoverFeatures({ application_id, status: "planned" }).capabilities;
}

export function getFeaturesForApplication(
  application_id: PlatformApplicationId,
): PlatformFeature[] {
  return PLATFORM_FEATURES.filter((f) => f.available_in.includes(application_id));
}

export function isCapabilityAvailable(
  capability_id: string,
  application_id?: PlatformApplicationId,
): boolean {
  const all = getAllCapabilities();
  const cap = all.find((c) => c.capability_id === capability_id);
  if (!cap) return false;
  if (cap.status !== "active") return false;
  if (application_id && !cap.consuming_applications.includes(application_id)) return false;
  return true;
}

export function getApplicationModuleSummary(
  application_id: PlatformApplicationId,
): {
  application:     PlatformApplication | undefined;
  required:        ModuleManifest[];
  optional:        ModuleManifest[];
  active_modules:  PlatformModuleId[];
  planned_modules: PlatformModuleId[];
} {
  const app = getApplicationDescriptor(application_id);
  const required = (app?.required_modules ?? [])
    .map((id) => getModuleManifest(id))
    .filter((m): m is ModuleManifest => m !== undefined);
  const optional = (app?.optional_modules ?? [])
    .map((id) => getModuleManifest(id))
    .filter((m): m is ModuleManifest => m !== undefined);

  return {
    application:     app,
    required,
    optional,
    active_modules:  [...required, ...optional]
      .filter((m) => m.status === "active")
      .map((m) => m.module_id),
    planned_modules: [...required, ...optional]
      .filter((m) => m.status === "planned")
      .map((m) => m.module_id),
  };
}

export function getPlatformFeatures(): PlatformFeature[] {
  return [...PLATFORM_FEATURES];
}

export function getPlatformFeature(feature_id: string): PlatformFeature | undefined {
  return PLATFORM_FEATURES.find((f) => f.feature_id === feature_id);
}
