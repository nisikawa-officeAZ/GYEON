// GYEON Business Hub — Subscription & Billing Center: Registry (Sprint 11Y)
//
// Aggregates all plans from both product families and provides the unified
// Subscription Center lookup surface.
//
// This is the primary query interface — consumers import from here, not from
// individual plan files, to maintain a stable API surface.
//
// Pure — no "use server", no async, no DB calls, no external calls.

import type {
  SubscriptionPlanDescriptor,
  AnyPlanId,
  ProductFamilyId,
  AIEntitlementId,
  ApplicationEntitlementId,
  EntitlementStatus,
} from "./subscription-center-types";
import { DETAILER_AGENT_PLAN_REGISTRY } from "./detailer-agent-plans";
import { GYEON_HUB_PLAN_REGISTRY } from "./gyeon-hub-plans";
import { PRODUCT_FAMILY_REGISTRY } from "./product-families";
import { AI_ENTITLEMENT_REGISTRY } from "./ai-entitlements";
import { APPLICATION_ENTITLEMENT_REGISTRY } from "./application-entitlements";
import { SUBSCRIPTION_POLICIES } from "./subscription-policy";

// ─── Unified plan registry ────────────────────────────────────────────────────

export const SUBSCRIPTION_PLAN_REGISTRY: SubscriptionPlanDescriptor[] = [
  ...DETAILER_AGENT_PLAN_REGISTRY,
  ...GYEON_HUB_PLAN_REGISTRY,
];

// ─── Plan lookups ─────────────────────────────────────────────────────────────

export function getSubscriptionPlan(
  plan_id: AnyPlanId,
): SubscriptionPlanDescriptor | undefined {
  return SUBSCRIPTION_PLAN_REGISTRY.find((p) => p.plan_id === plan_id);
}

export function getPlansForFamily(
  family_id: ProductFamilyId,
): SubscriptionPlanDescriptor[] {
  return SUBSCRIPTION_PLAN_REGISTRY
    .filter((p) => p.family_id === family_id)
    .sort((a, b) => a.tier_position - b.tier_position);
}

export function getAvailablePlans(): SubscriptionPlanDescriptor[] {
  return SUBSCRIPTION_PLAN_REGISTRY.filter((p) => p.status === "active");
}

export function getPlannedPlans(): SubscriptionPlanDescriptor[] {
  return SUBSCRIPTION_PLAN_REGISTRY.filter((p) => p.status === "planned");
}

// ─── AI entitlement queries ───────────────────────────────────────────────────

export function getPlanAIEntitlements(
  plan_id: AnyPlanId,
): AIEntitlementId[] {
  return getSubscriptionPlan(plan_id)?.ai_entitlements ?? [];
}

export function planHasAIEntitlement(
  plan_id: AnyPlanId,
  entitlement_id: AIEntitlementId,
): boolean {
  return getPlanAIEntitlements(plan_id).includes(entitlement_id);
}

// ─── Application entitlement queries ─────────────────────────────────────────

export function getPlanApplicationEntitlement(
  plan_id:        AnyPlanId,
  application_id: ApplicationEntitlementId,
): EntitlementStatus {
  return getSubscriptionPlan(plan_id)?.application_entitlements[application_id] ?? "not_available";
}

export function isApplicationIncluded(
  plan_id:        AnyPlanId,
  application_id: ApplicationEntitlementId,
): boolean {
  return getPlanApplicationEntitlement(plan_id, application_id) === "included";
}

export function isApplicationAvailable(
  plan_id:        AnyPlanId,
  application_id: ApplicationEntitlementId,
): boolean {
  const status = getPlanApplicationEntitlement(plan_id, application_id);
  return status === "included" || status === "addon";
}

// ─── Upgrade-required check ───────────────────────────────────────────────────

export function getMinimumPlanForAIEntitlement(
  family_id:      ProductFamilyId,
  entitlement_id: AIEntitlementId,
): SubscriptionPlanDescriptor | undefined {
  return getPlansForFamily(family_id).find((p) =>
    p.ai_entitlements.includes(entitlement_id),
  );
}

export function getMinimumPlanForApplication(
  family_id:      ProductFamilyId,
  application_id: ApplicationEntitlementId,
): SubscriptionPlanDescriptor | undefined {
  return getPlansForFamily(family_id).find((p) =>
    isApplicationAvailable(p.plan_id as AnyPlanId, application_id),
  );
}

// ─── Registry summary ─────────────────────────────────────────────────────────

export interface SubscriptionRegistrySummary {
  total_plan_count:             number;
  detailer_agent_plan_count:    number;
  gyeon_hub_plan_count:         number;
  product_family_count:         number;
  ai_entitlement_count:         number;
  application_entitlement_count: number;
  policy_count:                 number;
  strict_policy_count:          number;
  advisory_policy_count:        number;
}

export const SUBSCRIPTION_REGISTRY_SUMMARY: SubscriptionRegistrySummary = {
  total_plan_count:             SUBSCRIPTION_PLAN_REGISTRY.length,
  detailer_agent_plan_count:    DETAILER_AGENT_PLAN_REGISTRY.length,
  gyeon_hub_plan_count:         GYEON_HUB_PLAN_REGISTRY.length,
  product_family_count:         PRODUCT_FAMILY_REGISTRY.length,
  ai_entitlement_count:         AI_ENTITLEMENT_REGISTRY.length,
  application_entitlement_count: APPLICATION_ENTITLEMENT_REGISTRY.length,
  policy_count:                 SUBSCRIPTION_POLICIES.length,
  strict_policy_count:          SUBSCRIPTION_POLICIES.filter((p) => p.enforcement === "strict").length,
  advisory_policy_count:        SUBSCRIPTION_POLICIES.filter((p) => p.enforcement === "advisory").length,
};
