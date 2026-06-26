// DealerOS — Enterprise Organization Foundation: Roles & Permissions (Sprint 11V Phase D)
//
// Permission model for the multi-organization hierarchy.
//
// 7 organization-level roles:
//   platform_admin    — platform-wide authority
//   company_admin     — company-scoped authority
//   division_manager  — division management
//   branch_manager    — branch management
//   warehouse_manager — warehouse operations
//   dealer_owner      — individual dealer owner (maps to DealerRole "owner")
//   dealer_staff      — dealer staff (maps to DealerRole "manager" | "staff")
//
// Security notes:
//   - Organization roles do not replace Supabase Auth (they extend it)
//   - dealer_id must always come from getCurrentDealer() — never from org metadata
//   - Role checks for AI and admin operations are still enforced via requireAdmin()
//   - No authentication changes in this sprint
//
// Pure — no "use server", no async, no DB calls, no external calls.

import type {
  OrganizationRole,
  OrganizationRoleId,
  OrganizationPermission,
  OrganizationPermissionAction,
  OrganizationPermissionScope,
  OrganizationType,
} from "./organization-types";

// ─── Permission definitions ───────────────────────────────────────────────────

function perm(
  permission_id: string,
  resource: string,
  action: OrganizationPermissionAction,
  scope: OrganizationPermissionScope,
  description: string,
): OrganizationPermission {
  return { permission_id, resource, action, scope, description };
}

// Platform-level permissions
const P_PLATFORM_READ    = perm("plat:platform:read",    "platform",    "read",   "platform",      "Read platform-wide configuration and registry");
const P_PLATFORM_ADMIN   = perm("plat:platform:admin",   "platform",    "admin",  "platform",      "Manage platform configuration, policy, and applications");
const P_APP_MANAGE       = perm("plat:application:manage","application", "manage", "platform",      "Register and manage Platform applications");
const P_ORG_MANAGE       = perm("plat:org:manage",        "organization","manage", "platform",      "Create and modify any organization node");

// Company-level permissions
const P_COMPANY_READ     = perm("co:company:read",       "company",     "read",   "company",       "Read company hierarchy and member list");
const P_COMPANY_WRITE    = perm("co:company:write",      "company",     "write",  "company",       "Update company metadata and settings");
const P_DIVISION_MANAGE  = perm("co:division:manage",    "division",    "manage", "company",       "Create and manage divisions within the company");
const P_BILLING_MANAGE   = perm("co:billing:manage",     "billing",     "manage", "company",       "Manage company-level billing and plan subscriptions");
const P_ANALYTICS_READ   = perm("co:analytics:read",     "analytics",   "read",   "company",       "View company-wide analytics and dashboards");

// Division permissions
const P_DIV_READ         = perm("div:division:read",     "division",    "read",   "organization",  "Read division structure and member list");
const P_DIV_WRITE        = perm("div:division:write",    "division",    "write",  "organization",  "Update division metadata and settings");
const P_BRANCH_MANAGE    = perm("div:branch:manage",     "branch",      "manage", "organization",  "Create and manage branches within this division");
const P_DEALER_READ      = perm("div:dealer:read",       "dealer",      "read",   "organization",  "View dealers within this division");

// Branch permissions
const P_BRANCH_READ      = perm("br:branch:read",        "branch",      "read",   "organization",  "Read branch structure and member list");
const P_BRANCH_WRITE     = perm("br:branch:write",       "branch",      "write",  "organization",  "Update branch metadata and settings");
const P_BR_DEALER_READ   = perm("br:dealer:read",        "dealer",      "read",   "organization",  "View dealers within this branch");

// Warehouse permissions
const P_WH_READ          = perm("wh:warehouse:read",     "warehouse",   "read",   "organization",  "View warehouse inventory and orders");
const P_WH_WRITE         = perm("wh:warehouse:write",    "warehouse",   "write",  "organization",  "Manage warehouse inventory, pick-pack-ship");
const P_WH_MANAGE        = perm("wh:warehouse:manage",   "warehouse",   "manage", "organization",  "Manage warehouse settings, staff, and automation");

// Dealer-level permissions
const P_DEALER_SETTINGS  = perm("dl:settings:write",     "dealer_settings", "write", "own",        "Manage own dealer settings, staff, and configuration");
const P_AI_SETTINGS      = perm("dl:ai:write",           "ai_settings",     "write", "own",        "Configure AI providers and capability assignments for own dealer");
const P_ESTIMATES        = perm("dl:estimates:manage",   "estimates",       "manage","own",        "Create and manage estimates and work orders");
const P_INVOICES         = perm("dl:invoices:manage",    "invoices",        "manage","own",        "Create, void, and export invoices");
const P_DEALER_ANALYTICS = perm("dl:analytics:read",     "analytics",       "read",  "own",        "View own dealer analytics and reports");

// Staff-level permissions
const P_STAFF_ESTIMATES  = perm("st:estimates:write",    "estimates",       "write", "own",        "Create and update estimates (no delete, no void)");
const P_STAFF_READ       = perm("st:read:own",           "dealer_data",     "read",  "own",        "Read own dealer's customers, vehicles, and work orders");

// ─── Role definitions ─────────────────────────────────────────────────────────

const PLATFORM_ADMIN_ROLE: OrganizationRole = {
  role_id:             "platform_admin",
  display_name:        "Platform Administrator",
  description:         "Full authority over the Office AZ platform. Can manage all organizations, applications, and policies. Reserved for Office AZ engineering and operations.",
  applicable_scopes:   ["platform"],
  permissions:         [
    P_PLATFORM_READ, P_PLATFORM_ADMIN, P_APP_MANAGE, P_ORG_MANAGE,
    P_COMPANY_READ, P_COMPANY_WRITE, P_BILLING_MANAGE, P_ANALYTICS_READ,
  ],
  dealer_role_mapping: null,
  can_manage_children: true,
  can_manage_peers:    true,
};

const COMPANY_ADMIN_ROLE: OrganizationRole = {
  role_id:             "company_admin",
  display_name:        "Company Administrator",
  description:         "Authority over all divisions, branches, and dealers within a company. Manages company-level billing, analytics, and AI configuration.",
  applicable_scopes:   ["company"],
  permissions:         [
    P_COMPANY_READ, P_COMPANY_WRITE, P_DIVISION_MANAGE, P_BILLING_MANAGE, P_ANALYTICS_READ,
    P_DIV_READ, P_DEALER_READ, P_BR_DEALER_READ,
  ],
  dealer_role_mapping: null,
  can_manage_children: true,
  can_manage_peers:    false,
};

const DIVISION_MANAGER_ROLE: OrganizationRole = {
  role_id:             "division_manager",
  display_name:        "Division Manager",
  description:         "Manages all branches and dealers within a division. Views division analytics and manages branch structure.",
  applicable_scopes:   ["division"],
  permissions:         [
    P_DIV_READ, P_DIV_WRITE, P_BRANCH_MANAGE, P_DEALER_READ, P_ANALYTICS_READ,
  ],
  dealer_role_mapping: null,
  can_manage_children: true,
  can_manage_peers:    false,
};

const BRANCH_MANAGER_ROLE: OrganizationRole = {
  role_id:             "branch_manager",
  display_name:        "Branch Manager",
  description:         "Manages dealers and staff within a branch. Views branch-level analytics.",
  applicable_scopes:   ["branch"],
  permissions:         [
    P_BRANCH_READ, P_BRANCH_WRITE, P_BR_DEALER_READ, P_ANALYTICS_READ,
  ],
  dealer_role_mapping: null,
  can_manage_children: true,
  can_manage_peers:    false,
};

const WAREHOUSE_MANAGER_ROLE: OrganizationRole = {
  role_id:             "warehouse_manager",
  display_name:        "Warehouse Manager",
  description:         "Full control over warehouse operations: inventory, pick-pack-ship, staff, and automation rules. Scoped to a single warehouse.",
  applicable_scopes:   ["warehouse"],
  permissions:         [
    P_WH_READ, P_WH_WRITE, P_WH_MANAGE,
  ],
  dealer_role_mapping: null,
  can_manage_children: false,
  can_manage_peers:    false,
};

const DEALER_OWNER_ROLE: OrganizationRole = {
  role_id:             "dealer_owner",
  display_name:        "Dealer Owner",
  description:         "Owner of an individual detailing shop. Full control over own dealer: settings, staff, AI configuration, billing. Maps to DealerRole 'owner'.",
  applicable_scopes:   ["dealer"],
  permissions:         [
    P_DEALER_SETTINGS, P_AI_SETTINGS, P_ESTIMATES, P_INVOICES, P_DEALER_ANALYTICS,
  ],
  dealer_role_mapping: "owner",
  can_manage_children: false,
  can_manage_peers:    false,
};

const DEALER_STAFF_ROLE: OrganizationRole = {
  role_id:             "dealer_staff",
  display_name:        "Dealer Staff",
  description:         "Staff member at a detailing shop. Can create and update estimates and view work orders. Cannot manage settings or billing. Maps to DealerRole 'manager' | 'staff'.",
  applicable_scopes:   ["dealer"],
  permissions:         [
    P_STAFF_ESTIMATES, P_STAFF_READ,
  ],
  dealer_role_mapping: "staff",
  can_manage_children: false,
  can_manage_peers:    false,
};

// ─── Registry ─────────────────────────────────────────────────────────────────

export const ORGANIZATION_ROLES: OrganizationRole[] = [
  PLATFORM_ADMIN_ROLE,
  COMPANY_ADMIN_ROLE,
  DIVISION_MANAGER_ROLE,
  BRANCH_MANAGER_ROLE,
  WAREHOUSE_MANAGER_ROLE,
  DEALER_OWNER_ROLE,
  DEALER_STAFF_ROLE,
];

// ─── Permission matrix ────────────────────────────────────────────────────────

/** Pre-computed: which roles can access which organization type. */
export const ROLE_SCOPE_MATRIX: Record<OrganizationRoleId, OrganizationType[]> = {
  platform_admin:    ["platform", "company", "division", "branch", "warehouse", "dealer"],
  company_admin:     ["company", "division", "branch", "dealer"],
  division_manager:  ["division", "branch", "dealer"],
  branch_manager:    ["branch", "dealer"],
  warehouse_manager: ["warehouse"],
  dealer_owner:      ["dealer"],
  dealer_staff:      ["dealer"],
};

// ─── Lookup helpers ───────────────────────────────────────────────────────────

export function getOrganizationRole(role_id: OrganizationRoleId): OrganizationRole | undefined {
  return ORGANIZATION_ROLES.find((r) => r.role_id === role_id);
}

export function getRolesForScope(scope: OrganizationType): OrganizationRole[] {
  return ORGANIZATION_ROLES.filter((r) => r.applicable_scopes.includes(scope));
}

export function canRoleAccessScope(
  role_id: OrganizationRoleId,
  scope: OrganizationType,
): boolean {
  return ROLE_SCOPE_MATRIX[role_id].includes(scope);
}

export function getRoleFromDealerRole(dealer_role: string): OrganizationRole | undefined {
  return ORGANIZATION_ROLES.find((r) => r.dealer_role_mapping === dealer_role);
}

export function getDealerScopedRoles(): OrganizationRole[] {
  return ORGANIZATION_ROLES.filter((r) => r.applicable_scopes.includes("dealer"));
}

export function getPlatformScopedRoles(): OrganizationRole[] {
  return ORGANIZATION_ROLES.filter((r) => r.applicable_scopes.includes("platform"));
}
