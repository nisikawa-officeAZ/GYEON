// GYEON Business Hub — Subscription & Billing Center: Package Barrel (Sprint 11Y)
//
// Public API for the Subscription & Billing Center foundation.
// Import from here, not from sub-modules, to maintain a stable package surface.
//
// NOTE: This barrel exports ONLY the new Sprint 11Y foundation types and registries.
// The existing runtime subscription system (subscription-types.ts, feature-gates.ts,
// subscription.ts, saas-foundation-types.ts, usage.ts) retains its own import surface
// and is not re-exported here to avoid naming conflicts.

// ── Domain types ──────────────────────────────────────────────────────────────
export type {
  ProductFamilyId,
  DetailerAgentTierId,
  GyeonHubPlanId,
  AnyPlanId,
  BillingCycleId,
  EntitlementStatus,
  AIEntitlementId,
  ApplicationEntitlementId,
  SubscriptionPlanDescriptor,
  AIEntitlementDescriptor,
  ApplicationEntitlementDescriptor,
  ProductFamilyDescriptor,
  SubPolicyEnforcement,
  SubscriptionPolicy,
  UpgradePath,
  SubscriptionCenterDescriptor,
} from "./subscription-center-types";

// ── Product families ──────────────────────────────────────────────────────────
export {
  PRODUCT_FAMILY_REGISTRY,
  getProductFamily,
  getActiveProductFamilies,
  getPlannedProductFamilies,
} from "./product-families";

// ── Detailer Agent plans ──────────────────────────────────────────────────────
export {
  DETAILER_AGENT_PLAN_REGISTRY,
  getDetailerAgentPlan,
  getDetailerAgentTierOrder,
  isDetailerAgentUpgradeRequired,
} from "./detailer-agent-plans";

// ── GYEON Business Hub plans ──────────────────────────────────────────────────
export {
  GYEON_HUB_PLAN_REGISTRY,
  getGyeonHubPlan,
  getGyeonHubPlanOrder,
  isGyeonHubUpgradeRequired,
} from "./gyeon-hub-plans";

// ── AI entitlements ───────────────────────────────────────────────────────────
export {
  AI_ENTITLEMENT_REGISTRY,
  getAIEntitlement,
  getAIEntitlementsForDetailerTier,
  getAIEntitlementsForGyeonPlan,
} from "./ai-entitlements";

// ── Application entitlements ──────────────────────────────────────────────────
export {
  APPLICATION_ENTITLEMENT_REGISTRY,
  getApplicationEntitlement,
  getCurrentApplicationEntitlements,
  getFutureApplicationEntitlements,
  getApplicationsForDetailerTier,
  getApplicationsForGyeonPlan,
} from "./application-entitlements";

// ── Subscription policy ───────────────────────────────────────────────────────
export {
  SUBSCRIPTION_POLICIES,
  getSubscriptionPolicy,
  getStrictSubscriptionPolicies,
  getAdvisorySubscriptionPolicies,
  getPoliciesForFamily,
  getUniversalPolicies,
} from "./subscription-policy";

// ── Subscription registry ─────────────────────────────────────────────────────
export type { SubscriptionRegistrySummary } from "./subscription-registry";
export {
  SUBSCRIPTION_PLAN_REGISTRY,
  SUBSCRIPTION_REGISTRY_SUMMARY,
  getSubscriptionPlan,
  getPlansForFamily,
  getAvailablePlans,
  getPlannedPlans,
  getPlanAIEntitlements,
  planHasAIEntitlement,
  getPlanApplicationEntitlement,
  isApplicationIncluded,
  isApplicationAvailable,
  getMinimumPlanForAIEntitlement,
  getMinimumPlanForApplication,
} from "./subscription-registry";

// ── Platform Core bridge ──────────────────────────────────────────────────────
export type { SubscriptionModuleManifest } from "./platform-core-bridge";
export {
  PLATFORM_APP_TO_ENTITLEMENT,
  SUBSCRIPTION_MODULE_MANIFEST,
  SUBSCRIPTION_CENTER,
  getAvailablePlansForFamily,
  getEnabledAIEntitlements,
  isPlatformApplicationAccessible,
  getMinimumPlanForAI,
  getMinimumPlanForPlatformApp,
} from "./platform-core-bridge";
