// GYEON Business Hub — Subscription & Billing Center: Subscription Policy (Sprint 11Y)
//
// Governance rules for subscription management, entitlement enforcement, and billing.
//
// SUB-001 through SUB-006: strict — must never be violated
// SUB-007 through SUB-008: advisory — best-practice guidelines
//
// Pure — no "use server", no async, no DB calls, no external calls.

import type {
  SubscriptionPolicy,
  ProductFamilyId,
} from "./subscription-center-types";

// ─── Policy declarations ──────────────────────────────────────────────────────

const SUB_POLICIES: SubscriptionPolicy[] = [
  {
    policy_id:   "SUB-001",
    title:       "Feature Access Governed by Active Subscription Tier Only",
    description:
      "Access to any paid feature must be evaluated against the dealer's current active " +
      "subscription tier at the time of access. A past tier or a pending upgrade must not " +
      "grant access to features not included in the current plan. Fail-closed: if the " +
      "subscription status cannot be resolved, deny access to paid features.",
    enforcement: "strict",
    rationale:
      "Allowing stale or unverified subscription data to grant feature access creates " +
      "revenue leakage and undermines plan differentiation. Fail-closed prevents " +
      "accidental access during outages or resolution failures.",
    applies_to:  "all",
  },
  {
    policy_id:   "SUB-002",
    title:       "AI Entitlements Are Exclusively Controlled by Subscription Tier",
    description:
      "The set of AI capabilities available to a dealer must be derived from their " +
      "subscription tier's ai_entitlements array. AI capabilities must not be enabled " +
      "through any bypass, override, or configuration flag outside of the subscription system. " +
      "No AI capability may be activated without a corresponding entitlement.",
    enforcement: "strict",
    rationale:
      "AI features have per-use operational costs (provider API calls). Unbounded AI access " +
      "creates uncontrolled cost exposure. The entitlement model ensures AI costs scale " +
      "proportionally with subscription revenue.",
    applies_to:  "all",
  },
  {
    policy_id:   "SUB-003",
    title:       "Application Access Controlled by Subscription Application Entitlements",
    description:
      "Access to any Business Hub application (Dealer Agent, Distribution, Warehouse, " +
      "CRM, Accounting, AI Center, Communication Center) must be verified against the " +
      "current plan's application_entitlements. Applications with status 'not_available' " +
      "must be fully blocked, not degraded. Applications with status 'addon' require a " +
      "separately recorded activation before granting access.",
    enforcement: "strict",
    rationale:
      "Application access gating is the primary value differentiation between subscription " +
      "tiers. Leakage in application access directly undermines subscription upgrade incentives.",
    applies_to:  "all",
  },
  {
    policy_id:   "SUB-004",
    title:       "No Prices or Billing Data Hardcoded in Application Code",
    description:
      "Subscription prices, billing amounts, invoice totals, and currency values must " +
      "never be hardcoded in application code, TypeScript constants, or environment variables. " +
      "Prices must come from a database, CMS, or billing provider. Any prices used for " +
      "display or example purposes must be explicitly marked 'example_only' and must not " +
      "be used for billing calculations.",
    enforcement: "strict",
    rationale:
      "Hardcoded prices create deployment risk: a price change requires a code release. " +
      "Accidental use of example prices in billing calculations would constitute a billing error " +
      "and create legal liability.",
    applies_to:  "all",
  },
  {
    policy_id:   "SUB-005",
    title:       "Dealer-Owned Provider Keys Stored Server-Side and Isolated Per Tenant",
    description:
      "When a dealer configures their own AI provider keys (dealer_owned_provider entitlement), " +
      "those credentials must be encrypted at rest, stored server-side only, and scoped to " +
      "the dealer's tenant. Keys must never be returned to the browser, logged, or accessible " +
      "by other tenants. Credential access requires the dealer's active session.",
    enforcement: "strict",
    rationale:
      "AI provider keys have significant financial value — a leaked key allows unlimited " +
      "spend on the key owner's account. Server-side isolation and tenant scoping are " +
      "non-negotiable for Enterprise AI tier feature security.",
    applies_to:  ["detailer_agent"] satisfies ProductFamilyId[],
  },
  {
    policy_id:   "SUB-006",
    title:       "Subscription Data Isolated Per Tenant",
    description:
      "A dealer's subscription tier, plan history, and entitlement state must be scoped " +
      "to their tenant (dealer_id). Cross-tenant subscription reads are prohibited. " +
      "Platform admins may read subscription data across tenants only through dedicated " +
      "admin APIs with audit logging.",
    enforcement: "strict",
    rationale:
      "Subscription data reveals commercial relationship details (pricing, plan tier, " +
      "billing history). Cross-tenant access would expose competitor pricing and " +
      "franchise network commercial terms.",
    applies_to:  "all",
  },
  {
    policy_id:   "SUB-007",
    title:       "Upgrade Prompts Should Be Contextual and Non-Intrusive",
    description:
      "When a dealer encounters a feature gated by a higher plan, the UI should display " +
      "a contextual upgrade prompt explaining the specific feature blocked and the minimum " +
      "plan required. Upgrade prompts must not block the user's current workflow or display " +
      "in contexts unrelated to the gated feature.",
    enforcement: "advisory",
    rationale:
      "Intrusive upgrade prompts create frustration and churn. Contextual prompts, shown " +
      "at the point of need, convert at higher rates while maintaining user trust.",
    applies_to:  "all",
  },
  {
    policy_id:   "SUB-008",
    title:       "AI Usage Budget Warnings Should Trigger Before Limits Are Reached",
    description:
      "For plans with AI usage budget controls (enterprise_ai entitlement), the system " +
      "should notify the dealer when AI spend reaches 80% of the configured budget limit, " +
      "allowing proactive adjustment before the limit triggers a capability suspension.",
    enforcement: "advisory",
    rationale:
      "Silent hard limits create negative experiences. An 80% warning gives dealers time " +
      "to adjust usage, increase budget, or upgrade their plan without service interruption.",
    applies_to:  ["detailer_agent"] satisfies ProductFamilyId[],
  },
];

// ─── Registry ─────────────────────────────────────────────────────────────────

export const SUBSCRIPTION_POLICIES: SubscriptionPolicy[] = SUB_POLICIES;

// ─── Lookup helpers ───────────────────────────────────────────────────────────

export function getSubscriptionPolicy(
  policy_id: string,
): SubscriptionPolicy | undefined {
  return SUBSCRIPTION_POLICIES.find((p) => p.policy_id === policy_id);
}

export function getStrictSubscriptionPolicies(): SubscriptionPolicy[] {
  return SUBSCRIPTION_POLICIES.filter((p) => p.enforcement === "strict");
}

export function getAdvisorySubscriptionPolicies(): SubscriptionPolicy[] {
  return SUBSCRIPTION_POLICIES.filter((p) => p.enforcement === "advisory");
}

export function getPoliciesForFamily(
  family_id: ProductFamilyId,
): SubscriptionPolicy[] {
  return SUBSCRIPTION_POLICIES.filter(
    (p) =>
      p.applies_to === "all" ||
      (Array.isArray(p.applies_to) && p.applies_to.includes(family_id)),
  );
}

export function getUniversalPolicies(): SubscriptionPolicy[] {
  return SUBSCRIPTION_POLICIES.filter((p) => p.applies_to === "all");
}
