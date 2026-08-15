// Estimate Wizard Ver2.2 — Read-only pricing result contract (Phase 10D).
//
// The Wizard-facing result of running the PRODUCTION pricing engine over the canonical draft.
// Screen 7 consumes ONLY this type and never performs arithmetic. No price value here is computed
// by the Wizard — every number originates from the production engine. Coupons are always excluded
// (deferred); percentage discount is forwarded as intent (never converted to yen here).

import type { PricingCouponState, PricingDiscountIntent, CatalogLineRole } from "@/lib/pricing/canonical-pricing-engine";
import type { WizardPricingCompleteness } from "./wizard-pricing-identity";

export type { WizardPricingCompleteness } from "./wizard-pricing-identity";

export type WizardPricingStatus = "idle" | "calculating" | "success" | "error" | "incomplete";

/** How a displayed line derives its price (Phase 10F-R hybrid model). */
export type WizardPricingLineKind = "catalog" | "manual";

/** Non-blocking pricing issue (UI-safe; no stack traces). */
export interface WizardPricingIssue {
  code:     string;
  category: string | null;
  sourceId: string | null;
  message:  string;
}

/** Fields shared by every displayed line, independent of its price-identity source. */
export interface WizardPricingLineBase {
  category:       string;
  sourceId:       string;
  label:          string;
  quantity:       number;
  unitPrice:      number | null;
  lineSubtotal:   number | null;
  discountAmount: number | null; // document-level discount not distributed to lines → null
  taxAmount:      number | null; // document-level tax not distributed to lines → null
  lineTotal:      number | null;
}

// EW-UI-5A1-B1/B1E — the authoritative-identity invariant is encoded IN THE TYPE (discriminated on
// `kind`):
//   • kind "catalog" → pricingReferenceId is a NON-NULL stable catalog id AND catalogLineRole is a
//     non-null semantic role (a catalog line can NEVER be constructed without both — the compiler
//     forbids it). `${catalogLineRole}:${pricingReferenceId}` is unique even when a product repeats.
//   • kind "manual"  → pricingReferenceId is null and catalogLineRole is null.
// Both come from the engine line's pricing_reference_id / catalog_line_role — NEVER from the label,
// sourceId, index, or line order. B2 consumes these directly (not sourceId).
export type WizardPricingLineResult =
  | (WizardPricingLineBase & { kind: "catalog"; pricingReferenceId: string; catalogLineRole: CatalogLineRole })
  | (WizardPricingLineBase & { kind: "manual";  pricingReferenceId: null;   catalogLineRole: null });

/** A selected priceable service that could not be priced (surfaced on Screen 7; never dropped). */
export interface WizardUnresolvedItem {
  category: string;
  sourceId: string | null;
  code:     string;
  message:  string;
}

export interface WizardPricingResult {
  status:          WizardPricingStatus;
  completeness:    WizardPricingCompleteness; // hybrid completeness (Phase 10F-R)
  currency:        "JPY";
  lines:           WizardPricingLineResult[];
  unresolvedItems: WizardUnresolvedItem[];    // selected priceable services that could not be priced
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
  UNKNOWN_PRICING_REFERENCE:      "UNKNOWN_PRICING_REFERENCE",
  PERCENTAGE_NOT_SUPPORTED:       "PERCENTAGE_NOT_SUPPORTED",
  MANUAL_PRICE_REQUIRED:          "MANUAL_PRICE_REQUIRED",
  MANUAL_PRICING_IDENTITY_MISSING: "MANUAL_PRICING_IDENTITY_MISSING",
  INVALID_MANUAL_PRICE:           "INVALID_MANUAL_PRICE",
  INVALID_QUANTITY:               "INVALID_QUANTITY",
  NO_SERVICE_SELECTED:            "NO_SERVICE_SELECTED",
  PRODUCTION_PRICING_ERROR:       "PRODUCTION_PRICING_ERROR",
} as const;

export const EMPTY_WIZARD_PRICING_RESULT: WizardPricingResult = {
  status: "idle",
  completeness: "unavailable",
  currency: "JPY",
  lines: [],
  unresolvedItems: [],
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
