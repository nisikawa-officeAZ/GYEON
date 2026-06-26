// AZ Platform — Business Application Registry: Application Isolation Policy (Sprint 11W Phase C)
//
// Business-level isolation rules governing AZ Platform business applications.
//
// These rules complement the Platform Core cross-application policy (PLAT-001 through PLAT-010).
// They express the same principles from a business architecture perspective and add
// business-domain-specific constraints not covered at the platform level.
//
// Strict rules (APP-001 through APP-007): must never be violated
// Advisory rules (APP-008):               best-practice guidelines
//
// Pure — no "use server", no async, no DB calls, no external calls.

import type {
  BusinessApplicationId,
  BusinessApplicationPolicy,
} from "./business-application-types";

// ─── Isolation rules ──────────────────────────────────────────────────────────

const APP_ISOLATION_RULES: BusinessApplicationPolicy[] = [
  {
    policy_id:   "APP-001",
    title:       "Applications Must Not Import Each Other",
    description: "No business application may import code from another business application's source tree. The GYEON Dealer Agent must not import from enterprise_distribution, warehouse, accounting, crm, or ai_operations — and vice versa in all directions.",
    enforcement: "strict",
    rationale:   "Direct cross-application imports create hidden coupling that breaks the isolation contract. Changes in one application's internals must never require changes in another. All shared code belongs in Platform Core or a shared service module.",
    applies_to:  "all",
  },
  {
    policy_id:   "APP-002",
    title:       "Cross-Application Communication Through Shared Services Only",
    description: "When one application needs data or functionality from another, it must go through a declared Shared Service (authentication, authorization, ai_gateway, organization, etc.) — never by calling another application's server actions, routes, or libraries directly.",
    enforcement: "strict",
    rationale:   "Unmediated cross-application calls bypass the isolation boundary. Shared Services define an explicit, version-controlled contract. This is the only safe and maintainable cross-application communication pattern on AZ Platform.",
    applies_to:  "all",
  },
  {
    policy_id:   "APP-003",
    title:       "Application-Specific Data Must Remain Isolated",
    description: "Each business application owns its database. No application may run SQL queries against another application's tables, even if they share the same Supabase instance. Cross-application data access uses the relevant application's API or a shared service interface.",
    enforcement: "strict",
    rationale:   "Cross-schema queries create schema coupling and break RLS isolation. They make it impossible to migrate, shard, or independently scale application databases. The enterprise_distribution database must be completely inaccessible from the dealer_agent codebase.",
    applies_to:  "all",
  },
  {
    policy_id:   "APP-004",
    title:       "Cross-Application Workflows Require Explicit Platform Policy Declaration",
    description: "Any workflow that spans more than one business application must be declared in Platform Core policy before implementation. Ad-hoc cross-application workflows are prohibited.",
    enforcement: "strict",
    rationale:   "Undeclared cross-application workflows are the most dangerous form of coupling. They accumulate as technical debt, make system behavior unpredictable, and are nearly impossible to untangle after the fact. Explicit declaration enforces accountability.",
    applies_to:  "all",
  },
  {
    policy_id:   "APP-005",
    title:       "Tenant Identity Is Always Injected Server-Side",
    description: "Every business application must inject its primary tenant identifier (dealer_id for dealer_agent, company_id for enterprise_distribution, etc.) server-side from the authenticated session. Client-supplied tenant identifiers are never trusted.",
    enforcement: "strict",
    rationale:   "Client-supplied tenant IDs are the root cause of the most critical authorization bypass vulnerabilities. Every tenant isolation boundary depends on this rule. It is a non-negotiable security invariant across all AZ Platform applications.",
    applies_to:  "all",
  },
  {
    policy_id:   "APP-006",
    title:       "Organization Scope Validated Server-Side",
    description: "When an application operates at an organization scope above dealer level (company, division, branch), the organization context must be validated server-side from the authenticated user's organization membership. Client-supplied organization IDs are not trusted.",
    enforcement: "strict",
    rationale:   "Organization-scoped operations carry the same authorization risks as dealer-scoped operations. Privileged access (company admin, division manager) must be verified through the server-side organization registry, not accepted from the client.",
    applies_to:  ["enterprise_distribution", "warehouse", "accounting", "crm", "ai_operations"],
  },
  {
    policy_id:   "APP-007",
    title:       "AI Operations May Observe But Not Control Other Applications",
    description: "The AI Operations application may read usage metrics, logs, and health data from other applications' AI usage, but must not invoke or modify AI settings belonging to dealer_agent or any other application directly. Changes to application-owned AI settings must go through that application's own admin interface.",
    enforcement: "strict",
    rationale:   "AI Operations is an observability and reporting layer. Giving it write access to other applications' AI configurations would violate the application isolation boundary and create a cross-application control channel that bypasses per-application security controls.",
    applies_to:  ["ai_operations"],
  },
  {
    policy_id:   "APP-008",
    title:       "Feature Flag Gates Are Platform-Scoped and Must Not Be Bypassed",
    description: "Feature flags required to activate a business application (enterprise_distribution_enabled, warehouse_management_enabled, etc.) are platform-level flags resolved by Platform Core. Application code must not hard-code bypass conditions for these flags.",
    enforcement: "advisory",
    rationale:   "Platform-level feature flags are how AZ Platform controls which applications are available in a given deployment or to a given organization. Bypassing them in application code defeats the purpose of the gate and can expose unfinished features to production users.",
    applies_to:  ["enterprise_distribution", "warehouse", "accounting", "crm", "ai_operations"],
  },
];

// ─── Registry ─────────────────────────────────────────────────────────────────

export const BUSINESS_APPLICATION_POLICIES: BusinessApplicationPolicy[] = APP_ISOLATION_RULES;

/** All applications that must remain isolated from each other. */
export const ISOLATED_BUSINESS_APPLICATIONS: BusinessApplicationId[] = [
  "dealer_agent",
  "enterprise_distribution",
  "warehouse",
  "accounting",
  "crm",
  "ai_operations",
];

// ─── Lookup helpers ───────────────────────────────────────────────────────────

export function getAppPolicy(
  policy_id: string,
): BusinessApplicationPolicy | undefined {
  return BUSINESS_APPLICATION_POLICIES.find((p) => p.policy_id === policy_id);
}

export function getStrictAppPolicies(): BusinessApplicationPolicy[] {
  return BUSINESS_APPLICATION_POLICIES.filter((p) => p.enforcement === "strict");
}

export function getAdvisoryAppPolicies(): BusinessApplicationPolicy[] {
  return BUSINESS_APPLICATION_POLICIES.filter((p) => p.enforcement === "advisory");
}

export function getPoliciesForApp(
  application_id: BusinessApplicationId,
): BusinessApplicationPolicy[] {
  return BUSINESS_APPLICATION_POLICIES.filter(
    (p) =>
      p.applies_to === "all" ||
      (Array.isArray(p.applies_to) && p.applies_to.includes(application_id)),
  );
}

export function getPoliciesApplyingToAll(): BusinessApplicationPolicy[] {
  return BUSINESS_APPLICATION_POLICIES.filter((p) => p.applies_to === "all");
}

export function isApplicationIsolated(
  application_id: BusinessApplicationId,
): boolean {
  return ISOLATED_BUSINESS_APPLICATIONS.includes(application_id);
}
