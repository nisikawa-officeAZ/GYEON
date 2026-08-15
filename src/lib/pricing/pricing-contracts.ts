// DealerOS — Pricing Contract Extensions (Phase 10B).
//
// TYPES ONLY. This module introduces forward-looking, backward-compatible pricing contracts so
// future phases (10C/10D) can carry pricing policy, discount intent, coupon state, manual-override
// policy, and structured warnings/errors — WITHOUT changing any current pricing calculation.
//
// Nothing here alters runtime behavior: these are compile-time types (erased at build). The
// existing calculators (`pricing-engine.ts`, `estimate-totals.ts`) are untouched, and every
// existing caller of `EstimateResult` / `DiscountInput` continues to compile unchanged because all
// new fields are OPTIONAL. No formula, tax, discount, coupon, or rounding logic is defined here.

import type { EstimateResult, DiscountInput } from "./pricing-engine";

// ── Pricing policy (per-category) ────────────────────────────────────────────────
/** How a service category derives its price. No runtime behavior depends on this yet. */
export type PricingPolicy =
  | "catalog_only"
  | "manual_only"
  | "catalog_with_override"
  | "derived"
  | "not_priceable";

// ── Manual unit-price override policy ─────────────────────────────────────────────
export type ManualPricePolicy = "disabled" | "enabled" | "required";

// ── Discount intent (records operator intent; NOT a calculation) ─────────────────
export type PricingDiscountIntent =
  | { mode: "none" }
  | { mode: "fixed_amount"; amount: number; reason?: string }
  | { mode: "percentage"; percentage: number; reason?: string }
  | { mode: "dealer_rate"; percentage: number; source: "business_customer" };

// ── Coupon state (coupons remain EXCLUDED from totals until a production model exists) ──
export type PricingCouponState =
  | { status: "none" }
  | {
      status: "selected_not_priced";
      couponId: string;
      label: string;
      warningCode: "COUPON_PRICING_NOT_IMPLEMENTED";
    };

// ── Structured warnings / errors (non-throwing result channel) ───────────────────
export type PricingWarningCode =
  | "COUPON_PRICING_NOT_IMPLEMENTED"
  | "PERCENTAGE_DISCOUNT_NOT_APPLIED"
  | "MANUAL_OVERRIDE_IGNORED"
  | "PREVIEW_ONLY_COUPON"
  | "PREVIEW_ONLY_ITEM";

export interface PricingWarning {
  code:      PricingWarningCode;
  field?:    string | null;
  sourceId?: string | null;
  message:   string;
}

export type PricingErrorCode =
  | "MISSING_BODY_SIZE"
  | "NO_SERVICE_SELECTED"
  | "MISSING_MANUAL_PRICE"
  | "UNKNOWN_SERVICE_ID"
  | "UNKNOWN_OPTION_ID"
  | "PRICING_REFERENCE_NOT_FOUND"
  | "INVALID_QUANTITY"
  | "INVALID_DISCOUNT"
  | "INVALID_COUPON"
  | "PRODUCTION_PRICING_ERROR";

export interface PricingError {
  code:      PricingErrorCode;
  field?:    string | null;
  sourceId?: string | null;
  message:   string;
}

// ── Backward-compatible input extension ──────────────────────────────────────────
/** Optional, additive extension of the existing DiscountInput. Existing callers pass a plain
 *  DiscountInput and are unaffected; future callers may attach explicit intent / coupon state. */
export interface ExtendedDiscountInput extends DiscountInput {
  discountIntent?: PricingDiscountIntent;
  couponState?:    PricingCouponState;
}

/** Optional, additive extension a future pricing entry point may accept alongside services.
 *  Purely a contract — no consumer implements it in this phase. */
export interface PricingContractInputExtension {
  discountIntent?:                 PricingDiscountIntent;
  couponState?:                    PricingCouponState;
  manualOverridePolicyByCategory?: Partial<Record<string, ManualPricePolicy>>;
  pricingPolicyByCategory?:        Partial<Record<string, PricingPolicy>>;
}

// ── Backward-compatible result extension ─────────────────────────────────────────
/** Superset of the existing EstimateResult. All existing numeric totals are inherited UNCHANGED;
 *  the new fields are OPTIONAL so future phases can surface warnings/errors/policy/coupon state
 *  without altering existing totals or breaking existing `EstimateResult` consumers. */
export interface ExtendedPricingResult extends EstimateResult {
  warnings?:                 PricingWarning[];
  errors?:                   PricingError[];
  couponState?:              PricingCouponState;
  discountIntent?:           PricingDiscountIntent;
  pricingPolicyByCategory?:  Partial<Record<string, PricingPolicy>>;
  manualOverrideByCategory?: Partial<Record<string, ManualPricePolicy>>;
}
