// DealerOS — Platform Core: Cross-Application Policy (Sprint 11T Phase D)
//
// Canonical policy rules governing cross-application architecture.
//
// These rules enforce the Platform Core isolation contract:
//   - Applications are fully isolated from each other
//   - Shared services are the only cross-application communication channel
//   - Authentication, AI Gateway, and Authorization are always shared
//   - Each application manages its own database schema (no cross-schema joins)
//
// Policy rules are static declarations — not enforced at runtime in this sprint.
// Runtime enforcement (linting rules, import guards) is planned for Sprint 12+.
//
// Pure — no "use server", no async, no DB calls, no external calls.

import type {
  CrossApplicationPolicy,
  PlatformApplicationId,
  PlatformIsolationRule,
  PlatformModuleId,
} from "./platform-types";

// ─── Isolation rules ──────────────────────────────────────────────────────────

const ISOLATION_RULES: PlatformIsolationRule[] = [
  {
    rule_id:     "PLAT-001",
    title:       "No Direct Application Imports",
    description: "Application code must not import from another application's source tree. Dealer Agent must not import from enterprise_distribution and vice versa.",
    enforcement: "strict",
    rationale:   "Direct cross-application imports create hidden coupling. If one application needs a type from another, the type belongs in platform-core or a shared library.",
    applies_to:  "all",
  },
  {
    rule_id:     "PLAT-002",
    title:       "Shared Services Through Platform Core",
    description: "All cross-application shared functionality must be declared in src/lib/platform-core/ and consumed through that module. Applications may use src/lib/platform-core/index.ts but not each other's src/lib/.",
    enforcement: "strict",
    rationale:   "Platform Core is the single source of truth for what is shared. Undeclared sharing creates invisible dependencies that are difficult to track and break safely.",
    applies_to:  "all",
  },
  {
    rule_id:     "PLAT-003",
    title:       "Shared Authentication",
    description: "All platform applications use the same Supabase Auth instance within a deployment. A single user may have accounts in multiple applications, but sessions are application-scoped.",
    enforcement: "strict",
    rationale:   "A single identity provider simplifies user management, auditing, and SSO integration. It also allows Super Admin and Office AZ Admin roles to span applications.",
    applies_to:  "all",
  },
  {
    rule_id:     "PLAT-004",
    title:       "Shared AI Gateway",
    description: "All platform applications that use AI features must route through the shared AI Gateway module (src/lib/ai/). Applications do not maintain independent AI provider registries.",
    enforcement: "strict",
    rationale:   "A single AI Gateway ensures consistent key management, usage tracking, and provider adapter lifecycle across the platform. Duplicating the gateway per application is a maintenance and security liability.",
    applies_to:  ["dealer_agent", "enterprise_distribution", "warehouse", "accounting", "crm"],
  },
  {
    rule_id:     "PLAT-005",
    title:       "Separate Database Schema Per Application",
    description: "Each application has its own Supabase project (separate PostgreSQL instance). Applications must not join tables across applications. Cross-application data access uses API calls or shared service interfaces, never direct SQL.",
    enforcement: "strict",
    rationale:   "Shared schemas create deployment coupling, schema migration conflicts, and RLS complexity. Separate Supabase projects guarantee hard isolation between application data.",
    applies_to:  "all",
  },
  {
    rule_id:     "PLAT-006",
    title:       "API Keys Never Shared Between Applications",
    description: "AI provider API keys, LINE secrets, and other credentials are application-specific. A Dealer Agent dealer's OpenAI key must never be used for an EDP AI request.",
    enforcement: "strict",
    rationale:   "Cross-application key sharing violates the dealer-owned key model and creates audit liability. Each application manages credentials independently through the shared AI Gateway pattern.",
    applies_to:  "all",
  },
  {
    rule_id:     "PLAT-007",
    title:       "Identity Injection Always Server-Side",
    description: "The equivalent of dealer_id (or company_id in EDP, warehouse_id in WMS) must always be injected server-side from the authenticated session. It must never come from URL parameters, form inputs, or client-side state.",
    enforcement: "strict",
    rationale:   "Client-supplied identity is the root cause of the most common authorization bypass vulnerabilities. Server-side injection is a non-negotiable security invariant across all Office AZ applications.",
    applies_to:  "all",
  },
  {
    rule_id:     "PLAT-008",
    title:       "Shared Module Versions Are Pinned",
    description: "When a shared module (authentication, authorization, pdf, etc.) is consumed by multiple applications, all applications must use the same version. Breaking changes require a coordinated upgrade.",
    enforcement: "advisory",
    rationale:   "Version drift in shared modules is a common source of subtle bugs in multi-application platforms. Coordinated upgrades ensure consistent behavior.",
    applies_to:  "all",
  },
  {
    rule_id:     "PLAT-009",
    title:       "No Synthetic or Placeholder Data in Production",
    description: "Platform modules must never use fake data, placeholder implementations, or mock responses in production code paths. All feature gates and status flags must reflect actual system state.",
    enforcement: "strict",
    rationale:   "Placeholder code in production is indistinguishable from real code during reviews and creates false confidence in untested paths.",
    applies_to:  "all",
  },
  {
    rule_id:     "PLAT-010",
    title:       "Dealer-Facing UI May Remain Japanese",
    description: "Application UI visible to dealers and end customers may be written in Japanese. Platform Core code, comments, documentation, and reports must be in English.",
    enforcement: "advisory",
    rationale:   "The dealer-facing product serves a Japanese market. Forcing English UI reduces usability. Forcing English in infrastructure ensures all engineers can read and maintain it regardless of language background.",
    applies_to:  "all",
  },
];

// ─── Shared module set ────────────────────────────────────────────────────────

// Modules that are always shared across all applications.
// These must never be duplicated per application.
const ALWAYS_SHARED_MODULES: PlatformModuleId[] = [
  "authentication",
  "authorization",
  "ai_gateway",
  "ai_marketplace",
  "pdf",
  "notification",
];

// ─── Isolation boundary declarations ─────────────────────────────────────────

// These applications are confirmed to be fully isolated from each other.
// No application in this set may import from any other.
const ISOLATED_APPLICATIONS: PlatformApplicationId[] = [
  "dealer_agent",
  "enterprise_distribution",
  "warehouse",
  "accounting",
  "crm",
];

// ─── Policy object ────────────────────────────────────────────────────────────

export const PLATFORM_CROSS_APP_POLICY: CrossApplicationPolicy = {
  version:   "1.0.0",
  rules:     ISOLATION_RULES,
  shared:    ALWAYS_SHARED_MODULES,
  isolated:  ISOLATED_APPLICATIONS,
};

// ─── Lookup helpers ───────────────────────────────────────────────────────────

export function getIsolationRule(rule_id: string): PlatformIsolationRule | undefined {
  return ISOLATION_RULES.find((r) => r.rule_id === rule_id);
}

export function getStrictRules(): PlatformIsolationRule[] {
  return ISOLATION_RULES.filter((r) => r.enforcement === "strict");
}

export function getAdvisoryRules(): PlatformIsolationRule[] {
  return ISOLATION_RULES.filter((r) => r.enforcement === "advisory");
}

export function getRulesForApplication(
  application_id: PlatformApplicationId,
): PlatformIsolationRule[] {
  return ISOLATION_RULES.filter(
    (r) =>
      r.applies_to === "all" ||
      (Array.isArray(r.applies_to) && r.applies_to.includes(application_id)),
  );
}

export function isModuleAlwaysShared(module_id: PlatformModuleId): boolean {
  return ALWAYS_SHARED_MODULES.includes(module_id);
}

export function isApplicationIsolated(application_id: PlatformApplicationId): boolean {
  return ISOLATED_APPLICATIONS.includes(application_id);
}
