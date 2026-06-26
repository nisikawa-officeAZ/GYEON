// AZ Platform — Platform Core: Domain Types (Sprint 11T / updated Sprint 11W)
//
// Canonical type definitions for the AZ Platform Core.
// Platform Core is the shared infrastructure layer for all AZ Platform applications:
//
//   Applications (6):
//     dealer_agent, enterprise_distribution, warehouse, accounting, crm, ai_operations
//
//   Shared Modules (10):
//     authentication, authorization, ai_gateway, ai_marketplace,
//     ocr, line, media, notification, pdf, analytics
//
// Design principles:
//   - Applications are isolated from each other (no direct imports)
//   - All cross-app communication flows through Platform Core
//   - Authentication and AI Gateway are shared across all applications
//   - Subscription feature gates (AppFeature, FeatureKey) are Dealer Agent-scoped;
//     Platform Core operates at a higher architectural abstraction
//
// This module has NO dependencies on Dealer Agent-specific types
// (AppFeature, FeatureKey, DealerPlan) to remain application-agnostic.
//
// Pure — no "use server", no async, no DB calls, no external calls.

// ─── Application identifiers ──────────────────────────────────────────────────

export type PlatformApplicationId =
  | "dealer_agent"             // GYEON Detailer Agent — current active product
  | "enterprise_distribution"  // Office AZ Enterprise Distribution Platform (EDP)
  | "warehouse"                // Warehouse Management System (future)
  | "accounting"               // Accounting System (future)
  | "crm"                      // Customer Relationship Management (future)
  | "ai_operations";           // AI Operations Platform (future)

// ─── Module identifiers ───────────────────────────────────────────────────────

export type PlatformModuleId =
  | "authentication"    // Supabase Auth — shared identity provider
  | "authorization"     // RLS + plan-based feature gates
  | "ai_gateway"        // AI provider routing, key storage, adapter registry
  | "ai_marketplace"    // AI capability marketplace and recommendation engine
  | "ocr"               // Optical character recognition (documents, vehicle registration)
  | "line"              // LINE / LIFF messaging and automation
  | "media"             // Media asset management (images, video)
  | "notification"      // Email and push notification dispatch
  | "pdf"               // PDF generation (@react-pdf/renderer)
  | "analytics";        // Business analytics and reporting

// ─── Status enumerations ──────────────────────────────────────────────────────

export type PlatformCapabilityStatus =
  | "active"        // Implemented and available for use
  | "planned"       // Specification exists; implementation scheduled
  | "experimental"  // Available but not production-ready
  | "deprecated";   // Being phased out; avoid new usage

export type PlatformApplicationStatus =
  | "active"          // Deployed and in active use
  | "in_development"  // Implementation has begun
  | "planned"         // Roadmap item; not yet started
  | "deprecated";     // No longer maintained

// ─── Policy enforcement level ─────────────────────────────────────────────────

export type PolicyEnforcement =
  | "strict"    // Violation causes a build or runtime error
  | "advisory"; // Violation triggers a warning; not blocked

// ─── Dependency type ──────────────────────────────────────────────────────────

export type PlatformDependencyType =
  | "required"  // Module must be active for the application to function
  | "optional"  // Module enhances the application if present; not required
  | "planned";  // Dependency declared for future integration; not yet consumed

// ─── Platform capability ──────────────────────────────────────────────────────

export interface PlatformCapability {
  capability_id:    string;
  display_name:     string;
  description:      string;
  module:           PlatformModuleId;
  status:           PlatformCapabilityStatus;
  implementation_sprint: string;
  consuming_applications: PlatformApplicationId[];
}

// ─── Module dependency ────────────────────────────────────────────────────────

export interface PlatformModuleDependency {
  module_id:       PlatformModuleId;
  dependency_type: PlatformDependencyType;
  reason:          string;
}

// ─── Module manifest ──────────────────────────────────────────────────────────

export interface ModuleManifest {
  module_id:          PlatformModuleId;
  display_name:       string;
  description:        string;
  status:             PlatformCapabilityStatus;
  version:            string;
  source_path:        string;           // relative to src/lib/
  capabilities:       PlatformCapability[];
  dependencies:       PlatformModuleDependency[];
  consuming_applications: PlatformApplicationId[];
  spec_document:      string | null;    // relative to docs/master_specification/
  implementation_sprint: string;
}

// ─── Platform feature ─────────────────────────────────────────────────────────

export interface PlatformFeature {
  feature_id:    string;
  display_name:  string;
  description:   string;
  module:        PlatformModuleId;
  available_in:  PlatformApplicationId[];
  status:        PlatformCapabilityStatus;
}

// ─── Application descriptor ───────────────────────────────────────────────────

export interface PlatformApplication {
  application_id:    PlatformApplicationId;
  display_name:      string;
  description:       string;
  status:            PlatformApplicationStatus;
  target_users:      string;
  required_modules:  PlatformModuleId[];
  optional_modules:  PlatformModuleId[];
  spec_document:     string | null;          // relative to docs/master_specification/
  implementation_sprint: string | null;
  deployment_unit:   "separate" | "shared";  // whether it shares a Next.js app with another
  database_scope:    "shared_supabase" | "separate_supabase";
}

// ─── Isolation policy rule ────────────────────────────────────────────────────

export interface PlatformIsolationRule {
  rule_id:     string;
  title:       string;
  description: string;
  enforcement: PolicyEnforcement;
  rationale:   string;
  applies_to:  PlatformApplicationId[] | "all";
}

// ─── Cross-application policy ─────────────────────────────────────────────────

export interface CrossApplicationPolicy {
  version:    string;
  rules:      PlatformIsolationRule[];
  shared:     PlatformModuleId[];        // modules all applications may consume
  isolated:   PlatformApplicationId[];   // applications that must remain isolated
}

// ─── Feature discovery query options ─────────────────────────────────────────

export interface FeatureDiscoveryQuery {
  application_id?:  PlatformApplicationId;
  module_id?:       PlatformModuleId;
  status?:          PlatformCapabilityStatus;
}

// ─── Feature discovery result ─────────────────────────────────────────────────

export interface FeatureDiscoveryResult {
  query:        FeatureDiscoveryQuery;
  capabilities: PlatformCapability[];
  features:     PlatformFeature[];
  modules:      ModuleManifest[];
  total_count:  number;
}

// ─── Platform Core descriptor ─────────────────────────────────────────────────

export interface PlatformCoreDescriptor {
  version:                    string;
  sprint:                     string;
  application_count:          number;
  active_application_count:   number;
  planned_application_count:  number;
  module_count:               number;
  active_module_count:        number;
  planned_module_count:       number;
  capability_count:           number;
  isolation_rule_count:       number;
  cross_app_isolation:        true;    // always enforced
  shared_auth:                true;    // always shared
  shared_ai_gateway:          true;    // always shared
  platform_ui_available:      false;   // admin UI not yet built
  target_sprint:              string;
}
