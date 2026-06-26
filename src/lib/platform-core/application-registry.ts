// AZ Platform — Platform Core: Application Registry (Sprint 11T / updated Sprint 11W)
//
// Canonical registry of all AZ Platform applications.
// Each entry declares what the application is, its status, required modules,
// and where its specification lives.
//
// Current state:
//   Active (1):  dealer_agent
//   Planned (5): enterprise_distribution, warehouse, accounting, crm, ai_operations
//
// Applications are fully isolated — they do not import from each other.
// All cross-application shared services are consumed through platform-core.
//
// Pure — no "use server", no async, no DB calls, no external calls.

import type {
  PlatformApplication,
  PlatformApplicationId,
  PlatformModuleId,
} from "./platform-types";

// ─── Application descriptors ──────────────────────────────────────────────────

const DEALER_AGENT: PlatformApplication = {
  application_id:    "dealer_agent",
  display_name:      "GYEON Detailer Agent",
  description:       "Cloud-based business management platform for automotive detailing shops. Handles estimates, work orders, invoices, LINE messaging, OCR, reputation management, and AI content generation.",
  status:            "active",
  target_users:      "GYEON-certified detailing shop owners, managers, and technicians",
  required_modules: [
    "authentication",
    "authorization",
    "pdf",
  ],
  optional_modules: [
    "ai_gateway",
    "ai_marketplace",
    "ocr",
    "line",
    "media",
    "notification",
    "analytics",
  ],
  spec_document:         "01_PROJECT_OVERVIEW.md",
  implementation_sprint: "Sprint 1 (active)",
  deployment_unit:       "separate",
  database_scope:        "shared_supabase",
};

const ENTERPRISE_DISTRIBUTION: PlatformApplication = {
  application_id:    "enterprise_distribution",
  display_name:      "Enterprise Distribution Platform",
  description:       "B2B wholesale distribution management for Office AZ Group. Digitizes the supply chain from importer to wholesalers and retail stores. First target: Attraction Co., Ltd.",
  status:            "planned",
  target_users:      "Office AZ Group staff, Attraction Co., Ltd. team, authorized wholesalers and retail stores",
  required_modules: [
    "authentication",
    "authorization",
    "pdf",
    "notification",
  ],
  optional_modules: [
    "ai_gateway",
    "ai_marketplace",
    "analytics",
    "line",
  ],
  spec_document:         "ENTERPRISE_DISTRIBUTION_PLATFORM_SPEC.md",
  implementation_sprint: null,  // not yet started
  deployment_unit:       "separate",
  database_scope:        "separate_supabase",
};

const WAREHOUSE: PlatformApplication = {
  application_id:    "warehouse",
  display_name:      "Warehouse Management System",
  description:       "Inventory and fulfillment management for Office AZ Group warehouse operations. Tracks physical stock movements, pick/pack workflows, and outbound shipments.",
  status:            "planned",
  target_users:      "Warehouse staff, logistics coordinators",
  required_modules: [
    "authentication",
    "authorization",
    "notification",
  ],
  optional_modules: [
    "ai_gateway",
    "analytics",
  ],
  spec_document:         null,  // specification not yet written
  implementation_sprint: null,
  deployment_unit:       "separate",
  database_scope:        "separate_supabase",
};

const ACCOUNTING: PlatformApplication = {
  application_id:    "accounting",
  display_name:      "Accounting System",
  description:       "Financial management for Office AZ Group. Handles accounts receivable, accounts payable, general ledger, tax compliance, and financial reporting.",
  status:            "planned",
  target_users:      "Accounting team, finance managers",
  required_modules: [
    "authentication",
    "authorization",
    "pdf",
    "notification",
  ],
  optional_modules: [
    "analytics",
    "ai_gateway",
  ],
  spec_document:         null,
  implementation_sprint: null,
  deployment_unit:       "separate",
  database_scope:        "separate_supabase",
};

const CRM: PlatformApplication = {
  application_id:    "crm",
  display_name:      "Customer Relationship Management",
  description:       "Cross-company customer relationship management for Office AZ Group. Unified customer view, contact management, opportunity tracking, and communication history.",
  status:            "planned",
  target_users:      "Sales team, account managers, customer success",
  required_modules: [
    "authentication",
    "authorization",
    "notification",
  ],
  optional_modules: [
    "ai_gateway",
    "ai_marketplace",
    "analytics",
    "line",
    "media",
  ],
  spec_document:         null,
  implementation_sprint: null,
  deployment_unit:       "separate",
  database_scope:        "separate_supabase",
};

// ─── 6. AI Operations Platform ───────────────────────────────────────────────

const AI_OPERATIONS: PlatformApplication = {
  application_id:    "ai_operations",
  display_name:      "AI Operations Platform",
  description:       "Platform-level AI operations management for Office AZ Group. Monitors AI request execution, tracks usage and costs across all platform applications, manages the AI Marketplace capability catalog, and reports on provider health.",
  status:            "planned",
  target_users:      "Platform administrators, AI operations engineers, technical management",
  required_modules: [
    "authentication",
    "authorization",
    "ai_gateway",
    "ai_marketplace",
  ],
  optional_modules: [
    "analytics",
    "notification",
  ],
  spec_document:         null,
  implementation_sprint: null,
  deployment_unit:       "separate",
  database_scope:        "separate_supabase",
};

// ─── Registry ─────────────────────────────────────────────────────────────────

export const PLATFORM_APPLICATION_REGISTRY: PlatformApplication[] = [
  DEALER_AGENT,
  ENTERPRISE_DISTRIBUTION,
  WAREHOUSE,
  ACCOUNTING,
  CRM,
  AI_OPERATIONS,
];

// ─── Lookup helpers ───────────────────────────────────────────────────────────

export function getApplicationDescriptor(
  application_id: PlatformApplicationId,
): PlatformApplication | undefined {
  return PLATFORM_APPLICATION_REGISTRY.find(
    (a) => a.application_id === application_id,
  );
}

export function getActiveApplications(): PlatformApplication[] {
  return PLATFORM_APPLICATION_REGISTRY.filter((a) => a.status === "active");
}

export function getPlannedApplications(): PlatformApplication[] {
  return PLATFORM_APPLICATION_REGISTRY.filter((a) => a.status === "planned");
}

export function getApplicationsForModule(
  module_id: PlatformModuleId,
): PlatformApplication[] {
  return PLATFORM_APPLICATION_REGISTRY.filter(
    (a) =>
      a.required_modules.includes(module_id) ||
      a.optional_modules.includes(module_id),
  );
}

export function getRequiredModules(
  application_id: PlatformApplicationId,
): PlatformModuleId[] {
  return getApplicationDescriptor(application_id)?.required_modules ?? [];
}

export function getOptionalModules(
  application_id: PlatformApplicationId,
): PlatformModuleId[] {
  return getApplicationDescriptor(application_id)?.optional_modules ?? [];
}

export function getAllModulesForApplication(
  application_id: PlatformApplicationId,
): PlatformModuleId[] {
  const app = getApplicationDescriptor(application_id);
  if (!app) return [];
  return [...app.required_modules, ...app.optional_modules];
}
