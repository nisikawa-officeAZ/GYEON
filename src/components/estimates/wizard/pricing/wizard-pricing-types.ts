// Estimate Wizard Ver2.2 — Read-only pricing result contract (Phase 10D).
//
// The Wizard-facing result of running the PRODUCTION pricing engine over the canonical draft.
// Screen 7 consumes ONLY this type and never performs arithmetic. No price value here is computed
// by the Wizard — every number originates from the production engine. Coupons are always excluded
// (deferred); percentage discount is forwarded as intent (never converted to yen here).

import type { PricingCouponState, PricingDiscountIntent } from "@/lib/pricing/canonical-pricing-engine";

export type WizardPricingStatus = "idle" | "calculating" | "success" | "error" | "incomplete";

/** Non-blocking pricing issue (UI-safe; no stack traces). */
export interface WizardPricingIssue {
  code:     string;
  category: string | null;
  sourceId: string | null;
  message:  string;
}

export interface WizardPricingLineResult {
  sourceId:       string;
  label:          string;
  quantity:       number;
  unitPrice:      number | null;
  lineSubtotal:   number | null;
  discountAmount: number | null; // document-level discount not distributed to lines → null
  taxAmount:      number | null; // document-level tax not distributed to lines → null
  lineTotal:      number | null;
}

export interface WizardPricingResult {
  status:          WizardPricingStatus;
  currency:        "JPY";
  lines:           WizardPricingLineResult[];
  subtotal:        number | null;
  discountTotal:   number | null;
  couponTotal:     number | null; // ALWAYS 0 (coupons deferred)
  taxableSubtotal: number | null;
  taxTotal:        number | null;
  grandTotal:      number | null;
  warnings:        WizardPricingIssue[];
  errors:          WizardPricingIssue[];
  couponState:     PricingCouponState;
  discountIntent:  PricingDiscountIntent;
}

/** Stable Wizard pricing warning codes. */
export const WIZARD_PRICING_WARNINGS = {
  COUPON_PRICING_NOT_IMPLEMENTED: "COUPON_PRICING_NOT_IMPLEMENTED",
  MULTI_LAYER_NOT_MAPPED:         "MULTI_LAYER_NOT_MAPPED",
  MISSING_BODY_SIZE:              "MISSING_BODY_SIZE",
  PREVIEW_ONLY_ITEM:              "PREVIEW_ONLY_ITEM",
} as const;

/** Stable Wizard pricing error codes. */
export const WIZARD_PRICING_ERRORS = {
  UNKNOWN_PRICING_REFERENCE: "UNKNOWN_PRICING_REFERENCE",
  PERCENTAGE_NOT_SUPPORTED:  "PERCENTAGE_NOT_SUPPORTED",
  MANUAL_PRICE_REQUIRED:     "MANUAL_PRICE_REQUIRED",
  NO_SERVICE_SELECTED:       "NO_SERVICE_SELECTED",
  PRODUCTION_PRICING_ERROR:  "PRODUCTION_PRICING_ERROR",
} as const;

export const EMPTY_WIZARD_PRICING_RESULT: WizardPricingResult = {
  status: "idle",
  currency: "JPY",
  lines: [],
  subtotal: null,
  discountTotal: null,
  couponTotal: 0,
  taxableSubtotal: null,
  taxTotal: null,
  grandTotal: null,
  warnings: [],
  errors: [],
  couponState: { status: "none" },
  discountIntent: { mode: "none" },
};
