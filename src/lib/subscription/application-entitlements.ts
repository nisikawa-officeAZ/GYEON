// GYEON Business Hub — Subscription & Billing Center: Application Entitlements (Sprint 11Y)
//
// Defines which applications can be enabled or disabled per subscription plan.
// Each ApplicationEntitlementDescriptor declares the minimum plan required per family.
//
// These are DECLARATIONS ONLY — no runtime enforcement yet.
// Enforcement is planned for Sprint 12+ via the Platform Core feature gate integration.
//
// Pure — no "use server", no async, no DB calls, no external calls.

import type {
  ApplicationEntitlementDescriptor,
  ApplicationEntitlementId,
} from "./subscription-center-types";

// ─── Application entitlement declarations ─────────────────────────────────────

const APPLICATION_ENTITLEMENT_LIST: ApplicationEntitlementDescriptor[] = [
  {
    entitlement_id:           "dealer_agent",
    display_name:             "Dealer Agent",
    platform_application_ref: "dealer_agent",
    minimum_detailer_tier:    "starter",       // Available on all Detailer Agent tiers
    minimum_gyeon_plan:       "basic",         // Available from GYEON Basic
    is_future:                false,
  },
  {
    entitlement_id:           "communication_center",
    display_name:             "Communication Center",
    platform_application_ref: "dealer_agent",  // Currently housed in Dealer Agent context
    minimum_detailer_tier:    "professional",  // LINE communication from Professional
    minimum_gyeon_plan:       "pro",
    is_future:                false,
  },
  {
    entitlement_id:           "ai_center",
    display_name:             "AI Center",
    platform_application_ref: "ai_operations",
    minimum_detailer_tier:    "business_ai",   // AI Marketplace from Business AI
    minimum_gyeon_plan:       "pro_plus",
    is_future:                false,
  },
  {
    entitlement_id:           "crm",
    display_name:             "CRM",
    platform_application_ref: "crm",
    minimum_detailer_tier:    "business_ai",   // CRM from Business AI (future in Detailer)
    minimum_gyeon_plan:       "pro_plus",
    is_future:                true,
  },
  {
    entitlement_id:           "distribution",
    display_name:             "Distribution",
    platform_application_ref: "enterprise_distribution",
    minimum_detailer_tier:    "enterprise_ai", // Distribution from Enterprise AI
    minimum_gyeon_plan:       "enterprise",
    is_future:                true,
  },
  {
    entitlement_id:           "warehouse",
    display_name:             "Warehouse",
    platform_application_ref: "warehouse",
    minimum_detailer_tier:    "enterprise_ai", // Warehouse from Enterprise AI
    minimum_gyeon_plan:       "enterprise",
    is_future:                true,
  },
  {
    entitlement_id:           "accounting",
    display_name:             "Accounting",
    platform_application_ref: "accounting",
    minimum_detailer_tier:    "enterprise_ai", // Accounting from Enterprise AI
    minimum_gyeon_plan:       "enterprise",
    is_future:                true,
  },
];

// ─── Registry ─────────────────────────────────────────────────────────────────

export const APPLICATION_ENTITLEMENT_REGISTRY: ApplicationEntitlementDescriptor[] =
  APPLICATION_ENTITLEMENT_LIST;

// ─── Lookup helpers ───────────────────────────────────────────────────────────

export function getApplicationEntitlement(
  entitlement_id: ApplicationEntitlementId,
): ApplicationEntitlementDescriptor | undefined {
  return APPLICATION_ENTITLEMENT_REGISTRY.find((a) => a.entitlement_id === entitlement_id);
}

export function getCurrentApplicationEntitlements(): ApplicationEntitlementDescriptor[] {
  return APPLICATION_ENTITLEMENT_REGISTRY.filter((a) => !a.is_future);
}

export function getFutureApplicationEntitlements(): ApplicationEntitlementDescriptor[] {
  return APPLICATION_ENTITLEMENT_REGISTRY.filter((a) => a.is_future);
}

export function getApplicationsForDetailerTier(
  tier_id: import("./subscription-center-types").DetailerAgentTierId,
): ApplicationEntitlementDescriptor[] {
  const tierOrder: Record<import("./subscription-center-types").DetailerAgentTierId, number> = {
    starter:       1,
    professional:  2,
    business_ai:   3,
    enterprise_ai: 4,
  };
  return APPLICATION_ENTITLEMENT_REGISTRY.filter(
    (a) =>
      a.minimum_detailer_tier !== null &&
      tierOrder[a.minimum_detailer_tier] <= tierOrder[tier_id],
  );
}

export function getApplicationsForGyeonPlan(
  plan_id: import("./subscription-center-types").GyeonHubPlanId,
): ApplicationEntitlementDescriptor[] {
  const planOrder: Record<import("./subscription-center-types").GyeonHubPlanId, number> = {
    free:       0,
    basic:      1,
    pro:        2,
    pro_plus:   3,
    enterprise: 4,
  };
  return APPLICATION_ENTITLEMENT_REGISTRY.filter(
    (a) =>
      a.minimum_gyeon_plan !== null &&
      planOrder[a.minimum_gyeon_plan] <= planOrder[plan_id],
  );
}
