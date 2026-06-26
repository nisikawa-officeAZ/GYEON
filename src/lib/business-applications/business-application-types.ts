// AZ Platform — Business Application Registry: Domain Types (Sprint 11W Phase A)
//
// Canonical domain types for the AZ Platform Business Application Registry.
//
// The Business Application Registry is a coordination layer above Platform Core:
//   Platform Core:           technical module metadata (services, capabilities)
//   Business App Registry:   business-domain metadata (what each app does for users)
//
// Registered applications (6):
//   dealer_agent             — GYEON Detailer Agent (active)
//   enterprise_distribution  — Enterprise Distribution Platform (planned)
//   warehouse                — Warehouse Management System (planned)
//   accounting               — Accounting System (planned)
//   crm                      — Customer Relationship Management (planned)
//   ai_operations            — AI Operations Platform (planned)
//
// Design principles:
//   - Business applications are fully isolated from each other
//   - Cross-application communication flows through Platform Core or Shared Services only
//   - Organization scope is declared per application; never assumed at runtime
//   - No persistence: all static declarations only
//
// Pure — no "use server", no async, no DB calls, no external calls.

// ─── Application identifiers ──────────────────────────────────────────────────

export type BusinessApplicationId =
  | "dealer_agent"             // GYEON Detailer Agent
  | "enterprise_distribution"  // Enterprise Distribution Platform (Attraction)
  | "warehouse"                // Warehouse Management System
  | "accounting"               // Accounting System
  | "crm"                      // Customer Relationship Management
  | "ai_operations";           // AI Operations Platform

// ─── Application type ─────────────────────────────────────────────────────────

export type BusinessApplicationType =
  | "dealer_management"    // Detailing shop operations
  | "b2b_distribution"     // Wholesale B2B distribution
  | "warehouse_management" // Inventory and fulfillment
  | "financial_management" // Accounting and financial reporting
  | "customer_relationship"// CRM and sales management
  | "ai_operations";       // AI platform management and monitoring

// ─── Application status ───────────────────────────────────────────────────────

export type BusinessApplicationStatus =
  | "active"          // Live and in active use
  | "in_development"  // Implementation has begun
  | "planned"         // Architecture defined; implementation not yet started
  | "deprecated";     // No longer maintained

// ─── Business capability status ───────────────────────────────────────────────

export type BusinessCapabilityStatus =
  | "available"  // Implemented and live
  | "planned"    // Scheduled for near-term implementation
  | "future";    // Long-term roadmap; not yet scheduled

// ─── Business application capability ─────────────────────────────────────────

export interface BusinessApplicationCapability {
  capability_id:  string;
  display_name:   string;
  description:    string;
  status:         BusinessCapabilityStatus;
}

// ─── Shared service identifiers ───────────────────────────────────────────────
//
// Shared services are the only cross-application communication channel.
// Mirrors PlatformModuleId from platform-core plus "organization".
// Declared here as a standalone type to avoid circular imports from platform-core.

export type SharedServiceId =
  | "authentication"
  | "authorization"
  | "ai_gateway"
  | "ai_marketplace"
  | "ocr"
  | "line"
  | "media"
  | "notification"
  | "pdf"
  | "analytics"
  | "organization";

// ─── Business application manifest ───────────────────────────────────────────

export interface BusinessApplicationManifest {
  application_id:              BusinessApplicationId;
  display_name:                string;
  description:                 string;
  type:                        BusinessApplicationType;
  status:                      BusinessApplicationStatus;
  target_users:                string;
  capabilities:                BusinessApplicationCapability[];
  required_shared_services:    SharedServiceId[];
  optional_shared_services:    SharedServiceId[];
  /** OrganizationType values declared as strings to avoid importing organization/ here. */
  required_org_scope:          string[];
  required_subscription_level: string | null;
  required_feature_flags:      string[];
  /** OrganizationType values. */
  supported_org_types:         string[];
  /** OrganizationTier values. */
  supported_org_tiers:         string[];
  /** OrganizationRoleId values. */
  admin_roles:                 string[];
  default_roles:               string[];
  readonly_roles:              string[];
  /** Matches PlatformApplicationId — string to avoid circular imports from platform-core. */
  platform_application_ref:    string | null;
  spec_document:               string | null;
  implementation_sprint:       string | null;
}

// ─── Application isolation policy ────────────────────────────────────────────

export type AppPolicyEnforcement = "strict" | "advisory";

export interface BusinessApplicationPolicy {
  policy_id:   string;    // APP-001 … APP-NNN
  title:       string;
  description: string;
  enforcement: AppPolicyEnforcement;
  rationale:   string;
  applies_to:  BusinessApplicationId[] | "all";
}

// ─── Capability discovery ─────────────────────────────────────────────────────

export interface CapabilityDiscoveryQuery {
  application_id?: BusinessApplicationId;
  status?:         BusinessCapabilityStatus;
  shared_service?: SharedServiceId;
}

export interface CapabilityDiscoveryResult {
  query:                  CapabilityDiscoveryQuery;
  applications:           BusinessApplicationManifest[];
  total_capability_count: number;
  available_count:        number;
  planned_count:          number;
  future_count:           number;
}

// ─── Organization scope declaration ──────────────────────────────────────────

export interface ApplicationOrgScope {
  application_id:      BusinessApplicationId;
  /** OrganizationType values. */
  supported_org_types: string[];
  /** OrganizationTier values. */
  supported_org_tiers: string[];
  /** OrganizationRoleId values. */
  admin_roles:         string[];
  default_roles:       string[];
  readonly_roles:      string[];
  isolation_note:      string;
}

// ─── Registry descriptor ─────────────────────────────────────────────────────

export interface BusinessApplicationRegistryDescriptor {
  version:                    string;
  sprint:                     string;
  application_count:          number;
  active_application_count:   number;
  planned_application_count:  number;
  total_capability_count:     number;
  available_capability_count: number;
  policy_count:               number;
  strict_policy_count:        number;
  platform_core_integrated:   true;
  organization_integrated:    true;
  persistence_required:       false;
  target_sprint:              string;
}
