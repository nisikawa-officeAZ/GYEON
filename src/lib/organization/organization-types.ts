// DealerOS — Enterprise Organization Foundation: Domain Types (Sprint 11V Phase A)
//
// Canonical type definitions for the Office AZ multi-organization model.
//
// Hierarchy (6 levels):
//   Platform → Company → Division → Branch → Warehouse → Dealer
//
// Design principles:
//   - dealer_id isolation is preserved at all levels
//   - Organization types do not replace or weaken existing dealer_id scoping
//   - No persistence: all static registries only
//   - No platform-core imports in this file — bridge is in platform-core-bridge.ts
//
// Pure — no "use server", no async, no DB calls, no external calls.

// ─── Organization identifiers ──────────────────────────────────────────────────

/** Canonical ID format: "org_<slug>" for static orgs; "org_<uuid>" for runtime (future). */
export type OrganizationId = string;

// ─── Organization type ────────────────────────────────────────────────────────

export type OrganizationType =
  | "platform"    // The Office AZ platform root (singleton)
  | "company"     // Legal entity (GYEON Japan K.K., Attraction Co., Ltd.)
  | "division"    // Business division within a company
  | "branch"      // Physical or regional branch within a division
  | "warehouse"   // Warehouse or fulfillment center
  | "dealer";     // Individual detailing shop — maps to dealer_id

// ─── Organization tier ────────────────────────────────────────────────────────

/** Numeric depth of each OrganizationType in the hierarchy tree. */
export type OrganizationTier =
  | "tier_1"   // platform (depth 0)
  | "tier_2"   // company  (depth 1)
  | "tier_3"   // division (depth 2)
  | "tier_4"   // branch   (depth 3)
  | "tier_5"   // warehouse (depth 4)
  | "tier_6";  // dealer   (depth 5)

// ─── Organization status ──────────────────────────────────────────────────────

export type OrganizationStatus =
  | "active"    // Fully operational
  | "inactive"  // Temporarily not operating
  | "suspended" // Access suspended by platform admin
  | "planned"   // Roadmap item; not yet active
  | "archived"; // No longer in use; data retained

// ─── Core organization entity ─────────────────────────────────────────────────

export interface Organization {
  organization_id:   OrganizationId;
  display_name:      string;
  legal_name:        string | null;
  type:              OrganizationType;
  tier:              OrganizationTier;
  status:            OrganizationStatus;
  /** null for the platform root only. */
  parent_id:         OrganizationId | null;
  description:       string;
  country:           string;         // ISO 3166-1 alpha-2
  timezone:          string;         // IANA timezone
  /** True if this org maps to a Supabase dealer record. */
  is_dealer_linked:  boolean;
  /** Set only when type === "dealer". Never exposed to other orgs. */
  dealer_id_ref:     null;           // Always null in foundation — runtime links handled separately
  spec_version:      string;
}

// ─── Hierarchy node ───────────────────────────────────────────────────────────

export interface OrganizationHierarchyNode {
  organization:   Organization;
  parent:         OrganizationHierarchyNode | null;
  children:       OrganizationHierarchyNode[];
  /** 0 = platform root, 1 = company, 2 = division, etc. */
  depth:          number;
  /** Ordered list of organization_ids from root to this node (inclusive). */
  ancestor_path:  OrganizationId[];
}

// ─── Organization member ──────────────────────────────────────────────────────

export interface OrganizationMember {
  member_id:       string;
  organization_id: OrganizationId;
  role_id:         OrganizationRoleId;
  /** Populated only when role is dealer_owner or dealer_staff. */
  dealer_id:       string | null;
  display_name:    string;
  email:           string | null;
  is_active:       boolean;
  joined_at:       string;  // ISO 8601
}

// ─── Organization roles ───────────────────────────────────────────────────────

export type OrganizationRoleId =
  | "platform_admin"    // Full platform authority
  | "company_admin"     // Company-scoped authority
  | "division_manager"  // Division-scoped management
  | "branch_manager"    // Branch-scoped management
  | "warehouse_manager" // Warehouse operations
  | "dealer_owner"      // Individual dealer — maps to DealerRole "owner"
  | "dealer_staff";     // Dealer staff  — maps to DealerRole "staff" | "manager"

export interface OrganizationRole {
  role_id:              OrganizationRoleId;
  display_name:         string;
  description:          string;
  /** Which organization types this role is valid within. */
  applicable_scopes:    OrganizationType[];
  permissions:          OrganizationPermission[];
  /** Maps to the existing DealerRole union. null for non-dealer roles. */
  dealer_role_mapping:  string | null;
  can_manage_children:  boolean;
  can_manage_peers:     boolean;
}

// ─── Organization permissions ─────────────────────────────────────────────────

export type OrganizationPermissionAction =
  | "read"    // View only
  | "write"   // Create and update
  | "manage"  // CRUD + assign to others
  | "admin";  // Full control including policy changes

export type OrganizationPermissionScope =
  | "own"          // Only own dealer/member
  | "organization" // Within same organization node
  | "company"      // Across entire company tree
  | "platform";    // Entire platform

export interface OrganizationPermission {
  permission_id:  string;
  resource:       string;  // e.g. "dealer_settings", "ai_settings", "staff", "analytics"
  action:         OrganizationPermissionAction;
  scope:          OrganizationPermissionScope;
  description:    string;
}

// ─── Organization policy ──────────────────────────────────────────────────────

export type OrganizationPolicyEnforcement = "strict" | "advisory";

export interface OrganizationPolicy {
  policy_id:    string;  // ORG-001 … ORG-NNN
  title:        string;
  description:  string;
  enforcement:  OrganizationPolicyEnforcement;
  rationale:    string;
  applies_to:   OrganizationType[] | "all";
}

// ─── Application ownership ────────────────────────────────────────────────────

export type ApplicationOwnershipType =
  | "owner"      // Organization owns and operates the application
  | "operator"   // Organization operates the application for another company
  | "subscriber" // Organization subscribes to the application as a customer
  | "partner";   // Organization integrates with the application as a partner

export interface OrganizationApplicationOwnership {
  organization_id:    OrganizationId;
  /** String (not PlatformApplicationId) to avoid circular imports. */
  application_id:     string;
  ownership_type:     ApplicationOwnershipType;
  status:             "active" | "planned" | "suspended";
  deployment_target:  string | null;  // e.g., "gyeon-agent.vercel.app"
  notes:              string;
}

// ─── Foundation descriptor ────────────────────────────────────────────────────

export interface OrganizationFoundationDescriptor {
  version:                       string;
  sprint:                        string;
  hierarchy_level_count:         number;  // 6
  registered_organization_count: number;  // static entries
  role_count:                    number;  // 7
  policy_count:                  number;
  application_ownership_count:   number;
  platform_core_integrated:      boolean;
  /** Literal false — this module never persists. Persistence is in application DB layers. */
  persistence_required:          false;
  target_sprint:                 string;
}
