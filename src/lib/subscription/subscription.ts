"use server";

// PHASE58: Subscription service
// Reads from dealer_subscriptions table (new) or falls back to dealers.plan columns (legacy).
// dealer_id is ALWAYS resolved from getCurrentDealer() — never accepted from client.

import { createClient }    from "@/lib/supabase/server";
import { getCurrentDealer } from "@/lib/auth/get-current-dealer";
import { getCurrentPlan }   from "@/lib/plans/get-current-plan";
import {
  canUseFeature,
  AppFeature,
  DealerPlan,
} from "@/lib/plans/plan-types";
import {
  DealerSubscriptionWithPlan,
  SubscriptionPlanDB,
  PlanCode,
  SubscriptionStatus,
  isActiveSubscriptionStatus,
  LicenseLimitKey,
} from "./subscription-types";

// ─── Internal helpers ─────────────────────────────────────────────────────────

function mapLegacyStatus(s: string): SubscriptionStatus {
  if (s === "trial")     return "trial";
  if (s === "cancelled") return "cancelled";
  if (s === "expired")   return "cancelled";
  return "active";
}

// ─── Core service ─────────────────────────────────────────────────────────────

/**
 * Resolves the current dealer's active subscription.
 * Tries dealer_subscriptions (PHASE58) first; falls back to dealers.plan columns.
 * Never accepts dealer_id from the caller.
 */
export async function getCurrentDealerSubscription(): Promise<DealerSubscriptionWithPlan | null> {
  const dealer = await getCurrentDealer();
  if (!dealer) return null;

  const supabase = await createClient();

  // Try new table first (may not exist before migration 058 is applied)
  try {
    const { data, error } = await supabase
      .from("dealer_subscriptions")
      .select("*, plan:subscription_plans(*)")
      .eq("dealer_id", dealer.dealer_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!error && data) return data as DealerSubscriptionWithPlan;
  } catch {
    // Table not yet created — fall through to legacy
  }

  // Legacy fallback: dealers.plan columns
  const planInfo = await getCurrentPlan();
  return {
    id:                        dealer.dealer_id,
    dealer_id:                 dealer.dealer_id,
    plan_code:                 planInfo.plan as PlanCode,
    status:                    mapLegacyStatus(planInfo.subscription_status),
    trial_started_at:          null,
    trial_ends_at:             planInfo.subscription_status === "trial" ? planInfo.expired_at : null,
    current_period_started_at: planInfo.started_at,
    current_period_ends_at:    planInfo.subscription_status !== "trial" ? planInfo.expired_at : null,
    cancelled_at:              null,
    suspended_at:              null,
    notes:                     null,
    created_at:                planInfo.started_at ?? new Date().toISOString(),
    updated_at:                new Date().toISOString(),
  };
}

/**
 * Fetches all active subscription plans from the catalog.
 * Returns empty array if table not yet created.
 */
export async function getAvailablePlans(): Promise<SubscriptionPlanDB[]> {
  const supabase = await createClient();
  try {
    const { data } = await supabase
      .from("subscription_plans")
      .select("*")
      .eq("is_active", true)
      .order("sort_order");
    return (data ?? []) as SubscriptionPlanDB[];
  } catch {
    return [];
  }
}

/**
 * Returns the limits object for the current dealer's plan.
 * Falls back to Basic defaults if no plan catalog record found.
 */
export async function getPlanLimits(): Promise<Record<string, boolean | number>> {
  const sub = await getCurrentDealerSubscription();

  if (sub?.plan?.limits && Object.keys(sub.plan.limits).length > 0) {
    return sub.plan.limits;
  }

  // Built-in defaults keyed by plan_code
  const defaults: Record<PlanCode, Record<string, boolean | number>> = {
    basic: {
      staff:                    1,
      monthly_pdf_generations:  30,
      monthly_line_messages:    0,
      line_integration:         false,
    },
    pro: {
      staff:                    3,
      monthly_pdf_generations:  300,
      monthly_line_messages:    0,
      line_integration:         false,
    },
    pro_plus: {
      staff:                    10,
      monthly_pdf_generations:  1000,
      monthly_line_messages:    1000,
      line_integration:         true,
    },
  };

  return defaults[sub?.plan_code ?? "basic"] ?? defaults.basic;
}

/**
 * Returns true if the current dealer's subscription is in an active state
 * (active or trial, and not past expiry date).
 */
export async function isSubscriptionActive(): Promise<boolean> {
  const sub = await getCurrentDealerSubscription();
  if (!sub) return false;
  if (!isActiveSubscriptionStatus(sub.status)) return false;

  if (sub.status === "trial" && sub.trial_ends_at) {
    return new Date(sub.trial_ends_at) > new Date();
  }
  if (sub.status === "active" && sub.current_period_ends_at) {
    return new Date(sub.current_period_ends_at) > new Date();
  }
  return true;
}

/**
 * Checks whether the current dealer can access a given AppFeature.
 * Considers both subscription status and the plan feature matrix.
 * Fails closed for paid features; Basic features remain accessible even on expired status.
 */
export async function checkFeatureAccess(feature: AppFeature): Promise<boolean> {
  const sub = await getCurrentDealerSubscription();
  if (!sub) return false;

  const active = isActiveSubscriptionStatus(sub.status);

  // If subscription is not active, only Basic features are accessible
  if (!active) {
    return canUseFeature("basic", feature);
  }

  return canUseFeature(sub.plan_code as DealerPlan, feature);
}

/**
 * Checks if the current usage is within the plan's limit.
 */
export async function checkUsageLimit(limitKey: LicenseLimitKey, currentUsage: number): Promise<boolean> {
  const limits = await getPlanLimits();
  const limit = limits[limitKey];
  if (typeof limit === "boolean") return limit;
  if (typeof limit === "number")  return limit === 0 ? false : currentUsage <= limit;
  return true;
}
