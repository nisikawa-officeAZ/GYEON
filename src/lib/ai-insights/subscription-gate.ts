// GYEON Business Hub — AI Insights Dashboard: Subscription Gate (Sprint 12B)
//
// Maps AI insight types to the required subscription entitlements.
// Used to display upgrade prompts and gate advanced AI insight generation.
//
// Runtime enforcement:
//   Phase 12B — advisory only. Lookup functions document the gating requirement
//   but do not actively restrict content (since AI execution is deferred).
//   Phase 12C+ — the AI Gateway will call planHasAIEntitlement() before
//   invoking any AI provider for insight generation.
//
// Dependency: imports from subscription module only (one-way: ai-insights → subscription).
// Never import from ai-insights inside the subscription module.
//
// Pure — no "use server", no async, no DB calls, no external calls, no AI execution.

import {
  getMinimumPlanForAIEntitlement,
  planHasAIEntitlement,
} from "@/lib/subscription/subscription-registry";
import type { AnalyticsInsightType }   from "@/lib/analytics/analytics-types";
import type { AIEntitlementId, ProductFamilyId, SubscriptionPlanDescriptor } from "@/lib/subscription/subscription-center-types";

// ─── Entitlement mapping ───────────────────────────────────────────────────────

/**
 * Minimum entitlement required to unlock AI-generated content for each insight type.
 * null = no AI entitlement needed (deterministic insights available on all plans).
 */
export const INSIGHT_ENTITLEMENT_MAP: Record<AnalyticsInsightType, AIEntitlementId | null> = {
  next_action_suggestion: null,          // Deterministic — no AI entitlement
  risk_warning:           null,          // Deterministic variant available on all plans
  ai_summary:             "growth_ai",   // Full AI narrative requires growth_ai
  ai_recommendation:      "growth_ai",   // Evidence-based AI rec requires growth_ai
  anomaly_detection:      "growth_ai",   // Statistical anomaly detection requires growth_ai
  growth_opportunity:     "growth_ai",   // Opportunity scoring requires growth_ai
};

// ─── Lookups ──────────────────────────────────────────────────────────────────

export function getRequiredEntitlementForInsight(
  type_id: AnalyticsInsightType,
): AIEntitlementId | null {
  return INSIGHT_ENTITLEMENT_MAP[type_id] ?? null;
}

/**
 * Returns the minimum plan in the given product family that unlocks AI content
 * for the specified insight type.
 * Returns undefined when the insight type requires no entitlement.
 */
export function getMinimumPlanForInsightType(
  family_id: ProductFamilyId,
  type_id:   AnalyticsInsightType,
): SubscriptionPlanDescriptor | undefined {
  const required = getRequiredEntitlementForInsight(type_id);
  if (!required) return undefined;
  return getMinimumPlanForAIEntitlement(family_id, required);
}

/**
 * Returns true when the given plan includes the entitlement for the insight type.
 * Used by the AI Gateway (Sprint 12C+) before invoking AI providers.
 */
export function planCanGenerateInsight(
  plan_id:  string,
  type_id:  AnalyticsInsightType,
): boolean {
  const required = getRequiredEntitlementForInsight(type_id);
  if (!required) return true;   // No entitlement needed — always allowed
  return planHasAIEntitlement(plan_id as Parameters<typeof planHasAIEntitlement>[0], required);
}

// ─── Upgrade path summary ─────────────────────────────────────────────────────

/**
 * Summary of which insight types require plan upgrades.
 * Used for documentation and future upgrade prompt rendering.
 */
export const INSIGHT_ENTITLEMENT_SUMMARY = {
  description: "AI insight entitlement requirements for the Detailer Agent product family",
  deterministic_insights: [
    "next_action_suggestion — available on all plans, no AI entitlement required",
    "risk_warning — deterministic variant available on all plans",
  ],
  growth_ai_required_insights: [
    "ai_summary — Business AI plan or higher (Detailer Agent)",
    "ai_recommendation — Business AI plan or higher",
    "anomaly_detection — Business AI plan or higher",
    "growth_opportunity — Business AI plan or higher",
  ],
  enterprise_ai_exclusive: [] as string[],
  advisory_note:
    "Entitlement gating is advisory in Sprint 12B. Runtime enforcement is implemented " +
    "in Sprint 12C when the AI Gateway begins executing insight generation.",
} as const;
