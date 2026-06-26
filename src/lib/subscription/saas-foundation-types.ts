// DealerOS — SaaS Enterprise Foundation Types (Sprint 11Q)
//
// Pure TypeScript types formalizing the SaaS enterprise architecture reviewed in Sprint 11Q.
// No persistence, no migrations, no "use server". Architecture-level type definitions only.
//
// See: docs/master_specification/SAAS_ENTERPRISE_SPEC.md for the full review.

import type { PlanCode, SubscriptionStatus } from "./subscription-types";

// ─── Dealer lifecycle ─────────────────────────────────────────────────────────

/**
 * All distinct stages in the dealer lifecycle from registration to cancellation.
 * Not stored as a column — derived from the combination of dealers, dealer_billing,
 * dealer_settings, and dealer_subscriptions states.
 */
export type DealerLifecycleStage =
  | "registration"    // auth.users created; no dealers row yet
  | "pending"         // dealers row created; approval_status = 'pending'
  | "rejected"        // approval_status = 'rejected'; cannot proceed
  | "approved"        // approval_status = 'approved'; awaiting onboarding
  | "onboarding"      // dealer_settings.onboarding_completed = false
  | "active"          // onboarding complete; normal operation
  | "ai_active"       // pro_plus; dealer_settings.ai_settings configured
  | "line_active"     // pro_plus; LINE credentials configured
  | "suspended"       // dealer_billing.contract_status = 'suspended'
  | "cancelled";      // dealers.status = 'archived'; contract terminated

// ─── Extended plan tiers ──────────────────────────────────────────────────────

/**
 * ExtendedPlanCode — includes the proposed Enterprise tier above Pro Plus.
 *
 * The existing PlanCode ('basic' | 'pro' | 'pro_plus') type is NOT modified.
 * Enterprise is handled as an extension to preserve backward compatibility
 * with all existing switch statements and DB CHECK constraints.
 *
 * Enterprise plan requires CTO approval and migration 075 before activation.
 */
export type EnterprisePlanCode = "enterprise";
export type ExtendedPlanCode = PlanCode | EnterprisePlanCode;

// ─── Billing models ───────────────────────────────────────────────────────────

/**
 * BillingModel — all billing models the platform may support.
 *
 * Current: 'manual' only.
 * 'stripe_*' models require Stripe integration (Sprint 11T+, CTO approval required).
 */
export type BillingModel =
  | "manual"              // Current: admin creates invoices; bank transfer
  | "stripe_annual"       // Future: Stripe Subscriptions, annual interval
  | "stripe_monthly"      // Future: Stripe Subscriptions, monthly interval
  | "enterprise_contract" // Future: Service Order, net-30, custom pricing
  | "trial";              // Time-limited Pro+ access; expires at trial_ends_at

/**
 * BillingContractStatus — mirrors dealer_billing.contract_status CHECK constraint.
 * Kept here for type-safe application-layer use.
 */
export type BillingContractStatus =
  | "active"
  | "suspended"
  | "cancelled";

// ─── AI billing ownership ─────────────────────────────────────────────────────

/**
 * AIBillingOwnership — documents who pays for what in the AI billing model.
 *
 * This is a non-negotiable architectural constraint:
 *   - Office AZ bills the dealer for SaaS access (the GYEON platform).
 *   - The dealer bills their own AI provider for inference costs.
 *   - Office AZ does NOT intermediate AI inference costs.
 */
export interface AIBillingOwnership {
  /** Who pays Office AZ? The dealer. */
  saas_payer: "dealer";
  /** Who does Office AZ pay? Nobody — no AI infrastructure costs to Office AZ. */
  ai_infrastructure_payer: "dealer_to_provider_direct";
  /** Who intermediates AI billing? Nobody — dealer pays provider directly. */
  ai_billing_intermediary: null;
  /** Keys stored in: dealer_settings.ai_settings (encrypted, AES-256-GCM). */
  key_storage: "dealer_settings_jsonb";
  /** Cost currency between dealer and provider: always USD. */
  ai_cost_currency: "USD";
  /** Cost currency between dealer and Office AZ: JPY. */
  saas_cost_currency: "JPY";
}

export const AI_BILLING_OWNERSHIP: AIBillingOwnership = {
  saas_payer:                   "dealer",
  ai_infrastructure_payer:      "dealer_to_provider_direct",
  ai_billing_intermediary:      null,
  key_storage:                  "dealer_settings_jsonb",
  ai_cost_currency:             "USD",
  saas_cost_currency:           "JPY",
};

// ─── Feature gate evaluation ──────────────────────────────────────────────────

/**
 * FeatureGateEvaluation — richer result from checkFeatureAccess() for Sprint 11R.
 *
 * The current checkFeatureAccess() returns boolean. Sprint 11R will extend it
 * to return this richer result for UI upgrade prompts and AI readiness checks.
 */
export type FeatureGateBlockReason =
  | "plan_insufficient"       // feature requires a higher plan
  | "subscription_inactive"   // plan is active but subscription expired/cancelled
  | "billing_suspended"       // dealer_billing.contract_status = 'suspended'
  | "dealer_not_approved"     // dealers.approval_status != 'approved'
  | "ai_not_configured"       // plan allows AI but no API key stored
  | "ai_provider_unreachable"; // key stored but provider health check failed

export interface FeatureGateEvaluation {
  allowed: boolean;
  block_reason: FeatureGateBlockReason | null;
  required_plan: ExtendedPlanCode | null;    // minimum plan when block = 'plan_insufficient'
  current_plan: ExtendedPlanCode;
  subscription_status: SubscriptionStatus | null;
}

// ─── SaaS foundation status ───────────────────────────────────────────────────

/**
 * SaasFoundationStatus — Sprint 11Q architecture readiness descriptor.
 * Locked values document current state. Mutable fields will be updated in Sprint 11R+.
 */
export interface SaasFoundationStatus {
  version:                   string;
  sprint:                    string;
  plan_tiers_active:         3;         // basic, pro, pro_plus
  plan_tiers_proposed:       1;         // enterprise
  feature_gate_gap_billing:  true;      // contract_status not checked
  feature_gate_gap_approval: true;      // approval_status not checked
  ai_features_in_gate:       false;     // ai_* not in FeatureKey yet
  stripe_integration:        false;     // not yet implemented
  enterprise_activation:     false;     // requires migration 075 + CTO approval
  ai_budget_enforcement:     false;     // effective: needs dealer_ai_usage_log data
}

export const SAAS_FOUNDATION_STATUS: SaasFoundationStatus = {
  version:                   "1.0.0-review",
  sprint:                    "Sprint 11Q",
  plan_tiers_active:         3,
  plan_tiers_proposed:       1,
  feature_gate_gap_billing:  true,
  feature_gate_gap_approval: true,
  ai_features_in_gate:       false,
  stripe_integration:        false,
  enterprise_activation:     false,
  ai_budget_enforcement:     false,
};
