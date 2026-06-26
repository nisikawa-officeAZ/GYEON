// GYEON Business Hub — Subscription & Billing Center: Platform Core Bridge (Sprint 11Y)
//
// Exposes the Subscription & Billing Center to Platform Core.
//
// Dependency direction:
//   subscription/platform-core-bridge → platform-core/ (one-way)
//   platform-core/ does NOT import from subscription/ (no circular dependency)
//
// Provides Platform Core with:
//   - Available subscription plans per family
//   - AI entitlements per plan
//   - Application entitlements per plan
//   - Subscription tier metadata
//   - Upgrade-required state helpers
//
// No persistence. No database calls. No Stripe. Architecture declarations only.
//
// Pure — no "use server", no async, no DB calls, no external calls.

import type { PlatformApplicationId } from "@/lib/platform-core/platform-types";
import type {
  AIEntitlementId,
  ApplicationEntitlementId,
  AnyPlanId,
  SubscriptionCenterDescriptor,
} from "./subscription-center-types";
import {
  SUBSCRIPTION_PLAN_REGISTRY,
  SUBSCRIPTION_REGISTRY_SUMMARY,
  getSubscriptionPlan,
  getPlansForFamily,
  getPlanAIEntitlements,
  isApplicationAvailable,
  getMinimumPlanForAIEntitlement,
  getMinimumPlanForApplication,
} from "./subscription-registry";
import { SUBSCRIPTION_POLICIES, getStrictSubscriptionPolicies } from "./subscription-policy";
import { PRODUCT_FAMILY_REGISTRY } from "./product-families";

// ─── PlatformApplicationId → ApplicationEntitlementId mapping ─────────────────
//
// Maps Platform Core application IDs to their corresponding subscription entitlement IDs.
// Allows Platform Core to query subscription access without importing entitlement types.

export const PLATFORM_APP_TO_ENTITLEMENT: Record<PlatformApplicationId, ApplicationEntitlementId> = {
  dealer_agent:            "dealer_agent",
  enterprise_distribution: "distribution",
  warehouse:               "warehouse",
  accounting:              "accounting",
  crm:                     "crm",
  ai_operations:           "ai_center",
};

// ─── Platform Core-compatible queries ────────────────────────────────────────

/** Returns all available plans for a given product family, in tier order. */
export function getAvailablePlansForFamily(
  family_id: "gyeon_business_hub" | "detailer_agent",
) {
  return getPlansForFamily(family_id).map((p) => ({
    plan_id:          p.plan_id,
    display_name:     p.display_name,
    tier_position:    p.tier_position,
    status:           p.status,
    billing_cycles:   p.billing_cycles,
    price_reference:  p.price_reference,
    feature_highlights: p.feature_highlights,
  }));
}

/** Returns the AI entitlements for a given plan. */
export function getEnabledAIEntitlements(plan_id: AnyPlanId): AIEntitlementId[] {
  return getPlanAIEntitlements(plan_id);
}

/** Returns whether a Platform Core application is accessible on the given plan. */
export function isPlatformApplicationAccessible(
  plan_id:        AnyPlanId,
  application_id: PlatformApplicationId,
): boolean {
  const entitlement_id = PLATFORM_APP_TO_ENTITLEMENT[application_id];
  return isApplicationAvailable(plan_id, entitlement_id);
}

/** Returns the minimum plan required for a given AI entitlement, or undefined if not available. */
export function getMinimumPlanForAI(
  family_id:      "gyeon_business_hub" | "detailer_agent",
  entitlement_id: AIEntitlementId,
) {
  return getMinimumPlanForAIEntitlement(family_id, entitlement_id);
}

/** Returns the minimum plan required for a Platform Core application to become accessible. */
export function getMinimumPlanForPlatformApp(
  family_id:      "gyeon_business_hub" | "detailer_agent",
  application_id: PlatformApplicationId,
) {
  const entitlement_id = PLATFORM_APP_TO_ENTITLEMENT[application_id];
  return getMinimumPlanForApplication(family_id, entitlement_id);
}

// ─── Subscription module manifest ─────────────────────────────────────────────

export interface SubscriptionModuleManifest {
  module_id:                    "subscription";
  display_name:                 string;
  description:                  string;
  status:                       "active";
  version:                      string;
  source_path:                  string;
  product_family_count:         number;
  total_plan_count:             number;
  detailer_agent_tier_count:    number;
  gyeon_hub_plan_count:         number;
  ai_entitlement_count:         number;
  application_entitlement_count: number;
  policy_count:                 number;
  stripe_integrated:            false;
  persistence_required:         false;
  consuming_applications:       PlatformApplicationId[];
  spec_document:                string;
  implementation_sprint:        string;
}

export const SUBSCRIPTION_MODULE_MANIFEST: SubscriptionModuleManifest = {
  module_id:                    "subscription",
  display_name:                 "Subscription & Billing Center",
  description:
    "Foundation-level subscription and entitlement model for GYEON Business Hub. " +
    "Declares two product families (GYEON Business Hub, Detailer Agent), " +
    "9 total subscription plans, 10 AI entitlement levels, 7 application entitlements, " +
    "and 8 governance policies. " +
    "No payment provider integration. No schema changes. Foundation and architecture only.",
  status:                       "active",
  version:                      "1.0.0",
  source_path:                  "src/lib/subscription/",
  product_family_count:         SUBSCRIPTION_REGISTRY_SUMMARY.product_family_count,
  total_plan_count:             SUBSCRIPTION_REGISTRY_SUMMARY.total_plan_count,
  detailer_agent_tier_count:    SUBSCRIPTION_REGISTRY_SUMMARY.detailer_agent_plan_count,
  gyeon_hub_plan_count:         SUBSCRIPTION_REGISTRY_SUMMARY.gyeon_hub_plan_count,
  ai_entitlement_count:         SUBSCRIPTION_REGISTRY_SUMMARY.ai_entitlement_count,
  application_entitlement_count: SUBSCRIPTION_REGISTRY_SUMMARY.application_entitlement_count,
  policy_count:                 SUBSCRIPTION_REGISTRY_SUMMARY.policy_count,
  stripe_integrated:            false,
  persistence_required:         false,
  consuming_applications:       ["dealer_agent", "enterprise_distribution", "warehouse", "accounting", "crm", "ai_operations"],
  spec_document:                "docs/master_specification/SUBSCRIPTION_CENTER_SPEC.md",
  implementation_sprint:        "Sprint 11Y",
};

// ─── Subscription Center descriptor ──────────────────────────────────────────

export const SUBSCRIPTION_CENTER: SubscriptionCenterDescriptor = {
  version:                      "1.0.0",
  sprint:                       "Sprint 11Y",
  product_family_count:         SUBSCRIPTION_REGISTRY_SUMMARY.product_family_count,
  detailer_agent_tier_count:    SUBSCRIPTION_REGISTRY_SUMMARY.detailer_agent_plan_count,
  gyeon_hub_plan_count:         SUBSCRIPTION_REGISTRY_SUMMARY.gyeon_hub_plan_count,
  ai_entitlement_count:         SUBSCRIPTION_REGISTRY_SUMMARY.ai_entitlement_count,
  application_entitlement_count: SUBSCRIPTION_REGISTRY_SUMMARY.application_entitlement_count,
  policy_count:                 SUBSCRIPTION_REGISTRY_SUMMARY.policy_count,
  platform_core_integrated:     true,
  persistence_required:         false,
  stripe_integrated:            false,
  target_billing_sprint:        "Sprint 12+",
};
