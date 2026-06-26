// DealerOS — Enterprise Organization Foundation: Platform Core Bridge (Sprint 11V Phase E)
//
// Integration layer between organization/ and platform-core/.
//
// Design rules:
//   - Applications access organization metadata through Platform Core only (PLAT-002).
//   - This bridge file may import from platform-core/; all other organization/ files must not.
//   - platform-core/ does NOT import from organization/ — dependency is one-way.
//   - No direct cross-app imports. No business logic.
//
// This bridge provides:
//   1. OrganizationModuleManifest — declares organization as a platform module
//   2. Organization-to-Application compatibility queries
//   3. Policy summary for Platform Core consumption
//   4. A typed map from OrganizationType to PlatformApplicationId
//
// Pure — no "use server", no async, no DB calls, no external calls.

import type { PlatformApplicationId } from "@/lib/platform-core/platform-types";
import type { OrganizationType, OrganizationId } from "./organization-types";
import { HIERARCHY_LEVELS }            from "./organization-hierarchy";
import { ORGANIZATION_REGISTRY }       from "./organization-hierarchy";
import { ORGANIZATION_APPLICATION_OWNERSHIP } from "./organization-registry";
import { ORGANIZATION_POLICIES }       from "./organization-policy";
import { ORGANIZATION_ROLES }          from "./organization-roles";

// ─── Organization-to-Application type map ─────────────────────────────────────
//
// Each OrganizationType maps to the PlatformApplicationId values that operate at
// that level. Used by UI and policy checks to scope application access.

export const ORG_TYPE_APPLICATION_MAP: Record<OrganizationType, PlatformApplicationId[]> = {
  platform:  ["dealer_agent", "enterprise_distribution", "warehouse", "accounting", "crm", "ai_operations"],
  company:   ["dealer_agent", "enterprise_distribution", "ai_operations"],
  division:  ["dealer_agent", "enterprise_distribution"],
  branch:    ["dealer_agent"],
  warehouse: ["warehouse", "enterprise_distribution"],
  dealer:    ["dealer_agent"],
};

// ─── Reverse map: application → organization types ────────────────────────────

export const APPLICATION_ORG_TYPE_MAP: Record<PlatformApplicationId, OrganizationType[]> = {
  dealer_agent:            ["dealer", "branch", "division", "company", "platform"],
  enterprise_distribution: ["division", "company", "warehouse", "platform"],
  warehouse:               ["warehouse", "platform"],
  accounting:              ["company", "platform"],
  crm:                     ["company", "division", "platform"],
  ai_operations:           ["company", "platform"],
};

// ─── Query helpers ─────────────────────────────────────────────────────────────

export function getApplicationsForOrgType(
  type: OrganizationType,
): PlatformApplicationId[] {
  return ORG_TYPE_APPLICATION_MAP[type];
}

export function getOrgTypesForApplication(
  application_id: PlatformApplicationId,
): OrganizationType[] {
  return APPLICATION_ORG_TYPE_MAP[application_id];
}

export function isOrgTypeRelevantToApplication(
  type: OrganizationType,
  application_id: PlatformApplicationId,
): boolean {
  return ORG_TYPE_APPLICATION_MAP[type].includes(application_id);
}

export function getOrganizationsForPlatformApplication(
  application_id: PlatformApplicationId,
): typeof ORGANIZATION_REGISTRY {
  const relevantTypes = getOrgTypesForApplication(application_id);
  return ORGANIZATION_REGISTRY.filter((o) => relevantTypes.includes(o.type));
}

// ─── Organization module manifest (for Platform Core reference) ───────────────
//
// This describes the organization module as if it were a PlatformModule,
// so Platform Core documentation and tooling can reference it consistently.
// This is metadata only — the organization module is not registered in
// SHARED_SERVICES_REGISTRY (it is a foundation module, not a service module).

export interface OrganizationModuleManifest {
  module_id:          "organization";
  display_name:       string;
  description:        string;
  status:             "active";
  version:            string;
  source_path:        string;
  hierarchy_levels:   number;
  organization_count: number;
  role_count:         number;
  policy_count:       number;
  consuming_applications: PlatformApplicationId[];
  spec_document:      string;
  implementation_sprint: string;
}

export const ORGANIZATION_MODULE_MANIFEST: OrganizationModuleManifest = {
  module_id:          "organization",
  display_name:       "Enterprise Organization Foundation",
  description:        "Multi-organization hierarchy supporting Platform → Company → Division → Branch → Warehouse → Dealer. Defines roles, permissions, governance policies, and application ownership mapping.",
  status:             "active",
  version:            "1.0.0",
  source_path:        "src/lib/organization/",
  hierarchy_levels:   HIERARCHY_LEVELS.length,
  organization_count: ORGANIZATION_REGISTRY.length,
  role_count:         ORGANIZATION_ROLES.length,
  policy_count:       ORGANIZATION_POLICIES.length,
  consuming_applications: ["dealer_agent", "enterprise_distribution", "warehouse", "accounting", "crm", "ai_operations"],
  spec_document:      "docs/master_specification/ENTERPRISE_ORGANIZATION_SPEC.md",
  implementation_sprint: "Sprint 11V",
};

// ─── Cross-foundation policy summary ──────────────────────────────────────────
//
// Provides Platform Core a structured view of organization governance policies
// without Platform Core importing organization/ directly.

export interface OrgPolicySummary {
  strict_count:    number;
  advisory_count:  number;
  policy_ids:      string[];
  dealer_isolation_enforced: boolean;
  identity_server_side_enforced: boolean;
}

export const ORGANIZATION_POLICY_SUMMARY: OrgPolicySummary = {
  strict_count:    ORGANIZATION_POLICIES.filter((p) => p.enforcement === "strict").length,
  advisory_count:  ORGANIZATION_POLICIES.filter((p) => p.enforcement === "advisory").length,
  policy_ids:      ORGANIZATION_POLICIES.map((p) => p.policy_id),
  dealer_isolation_enforced: true,
  identity_server_side_enforced: true,
};
