// AZ Platform — Business Application Registry: Organization Integration (Sprint 11W Phase E)
//
// Per-application organization scope declarations.
//
// Each business application declares which organization types and tiers it supports,
// and which organization roles may administer, operate, or read it.
//
// Integration with Enterprise Organization Foundation (src/lib/organization/).
//
// Dependency direction:
//   business-applications/ → organization/ → platform-core/ (one-way chain)
//   organization/ does NOT import from business-applications/
//
// Pure — no "use server", no async, no DB calls, no external calls.

import type {
  OrganizationType,
  OrganizationTier,
  OrganizationRoleId,
} from "@/lib/organization/organization-types";
import type {
  ApplicationOrgScope,
  BusinessApplicationId,
} from "./business-application-types";

// ─── Per-application org scope declarations ───────────────────────────────────

const APPLICATION_ORG_SCOPES: ApplicationOrgScope[] = [
  {
    application_id:      "dealer_agent",
    supported_org_types: ["dealer", "branch", "division", "company", "platform"] satisfies OrganizationType[],
    supported_org_tiers: ["tier_6", "tier_4", "tier_3", "tier_2", "tier_1"]      satisfies OrganizationTier[],
    admin_roles:         ["platform_admin", "dealer_owner"]                        satisfies OrganizationRoleId[],
    default_roles:       ["dealer_owner", "dealer_staff"]                          satisfies OrganizationRoleId[],
    readonly_roles:      []                                                        satisfies OrganizationRoleId[],
    isolation_note:      "Primary scope is dealer. Each dealer operates fully isolated from all other dealers via RLS. Platform and company roles can view aggregate data only — never individual dealer records.",
  },
  {
    application_id:      "enterprise_distribution",
    supported_org_types: ["platform", "company", "division", "branch", "warehouse"] satisfies OrganizationType[],
    supported_org_tiers: ["tier_1", "tier_2", "tier_3", "tier_4", "tier_5"]         satisfies OrganizationTier[],
    admin_roles:         ["platform_admin", "company_admin"]                          satisfies OrganizationRoleId[],
    default_roles:       ["company_admin", "division_manager", "branch_manager"]      satisfies OrganizationRoleId[],
    readonly_roles:      ["warehouse_manager"]                                         satisfies OrganizationRoleId[],
    isolation_note:      "Each company (Attraction Co., Ltd.) operates in isolation. Warehouses and branches within the same company may share inventory and order visibility at company_admin discretion.",
  },
  {
    application_id:      "warehouse",
    supported_org_types: ["platform", "company", "division", "warehouse"] satisfies OrganizationType[],
    supported_org_tiers: ["tier_1", "tier_2", "tier_3", "tier_5"]         satisfies OrganizationTier[],
    admin_roles:         ["platform_admin", "company_admin"]               satisfies OrganizationRoleId[],
    default_roles:       ["warehouse_manager"]                             satisfies OrganizationRoleId[],
    readonly_roles:      ["division_manager"]                              satisfies OrganizationRoleId[],
    isolation_note:      "Each warehouse operates its own inventory. Warehouse managers can only manage their assigned warehouse. Company admins have cross-warehouse visibility for reporting.",
  },
  {
    application_id:      "accounting",
    supported_org_types: ["platform", "company", "division"] satisfies OrganizationType[],
    supported_org_tiers: ["tier_1", "tier_2", "tier_3"]      satisfies OrganizationTier[],
    admin_roles:         ["platform_admin", "company_admin"]  satisfies OrganizationRoleId[],
    default_roles:       ["company_admin", "division_manager"] satisfies OrganizationRoleId[],
    readonly_roles:      []                                   satisfies OrganizationRoleId[],
    isolation_note:      "Accounting is company-scoped. Financial data does not cross company boundaries. Division managers may view division-scoped financial data but may not create or modify financial records.",
  },
  {
    application_id:      "crm",
    supported_org_types: ["platform", "company", "division", "branch"] satisfies OrganizationType[],
    supported_org_tiers: ["tier_1", "tier_2", "tier_3", "tier_4"]      satisfies OrganizationTier[],
    admin_roles:         ["platform_admin", "company_admin"]            satisfies OrganizationRoleId[],
    default_roles:       ["company_admin", "division_manager", "branch_manager"] satisfies OrganizationRoleId[],
    readonly_roles:      []                                             satisfies OrganizationRoleId[],
    isolation_note:      "CRM accounts are company-scoped. Branch staff can only see accounts they manage directly. Division and company managers have broader account visibility.",
  },
  {
    application_id:      "ai_operations",
    supported_org_types: ["platform", "company"] satisfies OrganizationType[],
    supported_org_tiers: ["tier_1", "tier_2"]    satisfies OrganizationTier[],
    admin_roles:         ["platform_admin"]       satisfies OrganizationRoleId[],
    default_roles:       ["platform_admin", "company_admin"] satisfies OrganizationRoleId[],
    readonly_roles:      ["division_manager"]     satisfies OrganizationRoleId[],
    isolation_note:      "AI Operations is a platform-level observability application. Only platform and company admins can access it. Division managers have read-only access to usage reports scoped to their division.",
  },
];

// ─── Registry ─────────────────────────────────────────────────────────────────

export const APPLICATION_ORG_SCOPE_REGISTRY: ApplicationOrgScope[] = APPLICATION_ORG_SCOPES;

// ─── Lookup helpers ───────────────────────────────────────────────────────────

export function getOrgScopeForApplication(
  application_id: BusinessApplicationId,
): ApplicationOrgScope | undefined {
  return APPLICATION_ORG_SCOPE_REGISTRY.find(
    (s) => s.application_id === application_id,
  );
}

export function getApplicationsForOrgType(
  org_type: OrganizationType,
): BusinessApplicationId[] {
  return APPLICATION_ORG_SCOPE_REGISTRY
    .filter((s) => (s.supported_org_types as OrganizationType[]).includes(org_type))
    .map((s) => s.application_id);
}

export function getApplicationsForOrgTier(
  tier: OrganizationTier,
): BusinessApplicationId[] {
  return APPLICATION_ORG_SCOPE_REGISTRY
    .filter((s) => (s.supported_org_tiers as OrganizationTier[]).includes(tier))
    .map((s) => s.application_id);
}

export function getApplicationsForRole(
  role_id: OrganizationRoleId,
): BusinessApplicationId[] {
  return APPLICATION_ORG_SCOPE_REGISTRY
    .filter(
      (s) =>
        (s.admin_roles as OrganizationRoleId[]).includes(role_id) ||
        (s.default_roles as OrganizationRoleId[]).includes(role_id) ||
        (s.readonly_roles as OrganizationRoleId[]).includes(role_id),
    )
    .map((s) => s.application_id);
}

export function getAdminApplicationsForRole(
  role_id: OrganizationRoleId,
): BusinessApplicationId[] {
  return APPLICATION_ORG_SCOPE_REGISTRY
    .filter((s) => (s.admin_roles as OrganizationRoleId[]).includes(role_id))
    .map((s) => s.application_id);
}

export function getSupportedOrgTypesForApp(
  application_id: BusinessApplicationId,
): OrganizationType[] {
  const scope = getOrgScopeForApplication(application_id);
  return (scope?.supported_org_types ?? []) as OrganizationType[];
}

export function getSupportedOrgTiersForApp(
  application_id: BusinessApplicationId,
): OrganizationTier[] {
  const scope = getOrgScopeForApplication(application_id);
  return (scope?.supported_org_tiers ?? []) as OrganizationTier[];
}
