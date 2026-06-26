// DealerOS — Enterprise Organization Foundation: Governance Policy (Sprint 11V)
//
// Organizational governance policies — analogous to PLAT-001 through PLAT-010
// in Platform Core, but at the organization-hierarchy level.
//
// 8 policies: 6 strict + 2 advisory.
//
// These policies complement (not replace) the Platform Core isolation rules.
// All Platform Core rules (PLAT-001 through PLAT-010) remain in force.
//
// Pure — no "use server", no async, no DB calls, no external calls.

import type {
  OrganizationPolicy,
  OrganizationType,
} from "./organization-types";

// ─── Policy definitions ───────────────────────────────────────────────────────

export const ORGANIZATION_POLICIES: OrganizationPolicy[] = [
  {
    policy_id:   "ORG-001",
    title:       "Dealer Identity Isolation",
    description: "A dealer_id identifies an individual shop and is always scoped to that shop only. Organization metadata never provides cross-dealer data access. A company_admin or division_manager cannot read another dealer's estimates, invoices, or customer records.",
    enforcement: "strict",
    rationale:   "Dealer data contains personally identifiable customer information. Cross-dealer access would violate privacy contracts and weaken the multi-tenant security model.",
    applies_to:  "all",
  },
  {
    policy_id:   "ORG-002",
    title:       "Identity Always Server-Side",
    description: "dealer_id and organization_id must always be resolved server-side from the authenticated session (getCurrentDealer() or equivalent). They must never come from URL parameters, query strings, client-state, or organization metadata fields.",
    enforcement: "strict",
    rationale:   "Client-supplied identity fields are a horizontal privilege escalation vector. Server-side resolution is the only safe pattern.",
    applies_to:  "all",
  },
  {
    policy_id:   "ORG-003",
    title:       "No Cross-Company Data Access",
    description: "Company nodes are fully isolated from each other. A company_admin for GYEON Japan cannot access Attraction's orders, divisions, or member list. Cross-company visibility requires an explicit platform-level policy change.",
    enforcement: "strict",
    rationale:   "GYEON Japan and Attraction are independent legal entities. Cross-company data leakage is a data governance and legal compliance issue.",
    applies_to:  ["company", "division", "branch"],
  },
  {
    policy_id:   "ORG-004",
    title:       "Application Scoped to Correct Hierarchy Level",
    description: "Each Platform application maps to specific organization types. dealer_agent is dealer-scoped; enterprise_distribution is company/division-scoped; warehouse is warehouse-scoped. Applications must not operate outside their declared hierarchy scope.",
    enforcement: "strict",
    rationale:   "Incorrect hierarchy scoping causes data model mismatch and breaks isolation guarantees. Hierarchy levels in HIERARCHY_LEVELS define the canonical scope.",
    applies_to:  "all",
  },
  {
    policy_id:   "ORG-005",
    title:       "Platform Admin Minimum Cardinality",
    description: "At least one active platform_admin must always be registered. The platform cannot operate in a state where no platform_admin exists.",
    enforcement: "strict",
    rationale:   "Loss of platform admin access is an unrecoverable operational failure. Minimum cardinality prevents this condition.",
    applies_to:  ["platform"],
  },
  {
    policy_id:   "ORG-006",
    title:       "Hierarchy Integrity — No Cycles",
    description: "The organization tree must be a valid directed acyclic graph. No organization may have itself or any of its descendants as its parent. The parent_id chain must always resolve to the platform root.",
    enforcement: "strict",
    rationale:   "Circular hierarchies cause infinite loops in ancestor traversal, break authorization scope computation, and produce undefined behavior in hierarchy-based queries.",
    applies_to:  "all",
  },
  {
    policy_id:   "ORG-007",
    title:       "Dealer Role Mapping Consistency",
    description: "When an organization-level role maps to a DealerRole (via dealer_role_mapping), the mapping must be consistent with the Dealer Agent's existing role model. New organization roles that apply to dealers must declare their dealer_role_mapping explicitly.",
    enforcement: "advisory",
    rationale:   "Consistent role mapping prevents permission gaps between the organization model and the existing dealer role enforcement in Dealer Agent.",
    applies_to:  ["dealer"],
  },
  {
    policy_id:   "ORG-008",
    title:       "Warehouse Organization Aligned to Warehouse Application",
    description: "Organization nodes of type 'warehouse' should map to the warehouse application in Platform Core. Warehouse operations (inventory, pick-pack-ship) must not be implemented within the dealer_agent application.",
    enforcement: "advisory",
    rationale:   "Warehouse management is a distinct business domain that requires a separate application per PLAT-005 (Separate Database Schema Per Application).",
    applies_to:  ["warehouse"],
  },
];

// ─── Policy groups ────────────────────────────────────────────────────────────

export const STRICT_ORG_POLICIES = ORGANIZATION_POLICIES.filter(
  (p) => p.enforcement === "strict",
);

export const ADVISORY_ORG_POLICIES = ORGANIZATION_POLICIES.filter(
  (p) => p.enforcement === "advisory",
);

// ─── Lookup helpers ───────────────────────────────────────────────────────────

export function getOrganizationPolicy(policy_id: string): OrganizationPolicy | undefined {
  return ORGANIZATION_POLICIES.find((p) => p.policy_id === policy_id);
}

export function getPoliciesForScope(scope: OrganizationType): OrganizationPolicy[] {
  return ORGANIZATION_POLICIES.filter(
    (p) =>
      p.applies_to === "all" ||
      (Array.isArray(p.applies_to) && p.applies_to.includes(scope)),
  );
}

export function getStrictPolicies(): OrganizationPolicy[] {
  return STRICT_ORG_POLICIES;
}

export function getAdvisoryPolicies(): OrganizationPolicy[] {
  return ADVISORY_ORG_POLICIES;
}
