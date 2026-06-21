"use server";

// PHASE58: Feature gate utilities
// Bridges FeatureKey (PHASE58 spec) to AppFeature (existing plan-types).
// Use these functions in server components and server actions.

import {
  AppFeature,
  canUseFeature,
  planLabel,
  requiredPlanForFeature,
  DealerPlan,
} from "@/lib/plans/plan-types";
import { getCurrentDealerSubscription, isSubscriptionActive } from "./subscription";
import { FeatureKey } from "./subscription-types";

// ─── Feature key mapping ──────────────────────────────────────────────────────

/** Maps PHASE58 FeatureKey names to the existing AppFeature names in plan-types. */
const FEATURE_KEY_MAP: Record<FeatureKey, AppFeature | null> = {
  customers:             "customers",
  vehicles:              "vehicles",
  estimates:             "estimates",
  pdf_preview:           "estimate_pdf",
  pdf_generation:        "estimate_pdf",
  product_orders:        "product_orders",
  work_orders:           "work_orders",
  completion_reports:    "completion_reports",
  invoices:              "invoices",
  payments:              "payments",
  reservations:          "reservations",
  maintenance_reminders: "maintenance",
  line_integration:      "line",
  line_messages:         "line_crm",
  automatic_reminders:   "auto_notifications",
  // Always accessible — no AppFeature equivalent
  audit_logs:            null,
  admin_dashboard:       null,
};

// ─── Core gate functions ──────────────────────────────────────────────────────

/**
 * Returns true if the current dealer can access the given feature.
 * Fail-closed: returns false on any resolution error for paid features.
 */
export async function canUseFeatureGate(featureKey: FeatureKey): Promise<boolean> {
  // Always-on features
  if (featureKey === "audit_logs" || featureKey === "admin_dashboard") return true;

  const appFeature = FEATURE_KEY_MAP[featureKey];
  if (appFeature === null) return true;

  const sub = await getCurrentDealerSubscription();
  if (!sub) return false;

  const active = await isSubscriptionActive();

  if (!active) {
    // Subscription inactive: fall back to Basic features only
    return canUseFeature("basic", appFeature);
  }

  return canUseFeature(sub.plan_code as DealerPlan, appFeature);
}

/**
 * Throws an error with a Japanese message if the feature is not accessible.
 * Use in server actions to guard paid operations.
 */
export async function requireFeatureOrThrow(featureKey: FeatureKey): Promise<void> {
  const allowed = await canUseFeatureGate(featureKey);
  if (!allowed) {
    const message = getUpgradeMessage(featureKey);
    throw new Error(message);
  }
}

/**
 * Returns a Japanese upgrade message for the given feature.
 */
export function getUpgradeMessage(featureKey: FeatureKey): string {
  const appFeature = FEATURE_KEY_MAP[featureKey];
  if (!appFeature) return "";

  const required = requiredPlanForFeature(appFeature) as DealerPlan;
  const label    = planLabel(required);
  return `この機能は ${label} プラン以上でご利用いただけます。プランのアップグレードについては管理者へお問い合わせください。`;
}

/**
 * Returns the minimum plan label required for a feature key.
 */
export function getRequiredPlanLabel(featureKey: FeatureKey): string {
  const appFeature = FEATURE_KEY_MAP[featureKey];
  if (!appFeature) return "";
  return planLabel(requiredPlanForFeature(appFeature) as DealerPlan);
}
