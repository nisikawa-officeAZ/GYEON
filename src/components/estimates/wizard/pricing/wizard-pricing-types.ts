// Estimate Wizard Ver2.2 — Read-only pricing result contract (Phase 10D).
//
// The Wizard-facing result of running the PRODUCTION pricing engine over the canonical draft.
// Screen 7 consumes ONLY this type and never performs arithmetic. No price value here is computed
// by the Wizard — every number originates from the production engine. Configured coupon discounts
// are included by the engine; percentage discount is forwarded as intent (never converted to yen here).

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

/**
 * GDA-ESTIMATE-QUANTITY-POLICY-R1 (Stage A) — configured quantity bounds a final-review quantity edit
 * must satisfy (`maxQuantity` null = unbounded above). Defined here so the presentation layer and the
 * adjustment rule share ONE type; `wizard-review-line-adjustments` re-exports it unchanged.
 */
export type WizardReviewQuantityBounds = {
  readonly minQuantity: number;
  readonly maxQuantity: number | null;
  /**
   * GDA-ESTIMATE-QUANTITY-POLICY-R1 (Stage B) — present ONLY on a partial PPF part line: the selected
   * part whose canonical Step-4 quantity a valid final-review edit writes through to. Absent on every
   * other editable line (store options keep their review-only override).
   */
  readonly ppfPartCode?: string;
  /**
   * GDA-ESTIMATE-QUANTITY-POLICY-R1 (B5c2) — present ONLY on a DEDICATED wheel / glass menu line
   * (plan §24.1): the section kind and the stable dealer menu code whose canonical Step-4
   * `quantitiesByMenu` entry a valid final-review edit writes through to. Absent on every other line.
   * Mutually exclusive with `ppfPartCode`.
   * GDA-OTHER-COATINGS-R1 (C4) — ALSO present on a QUANTITY-BEARING other-coating menu line
   * (`quantityRequired: true` on the dealer row) with kind `other_coating`; a FIXED-ONE other-coating
   * line (`quantityRequired: false`) is annotated `null` (read-only quantity 1), never with bounds.
   */
  readonly dedicatedMenu?: WizardReviewDedicatedMenuRef;
};

/**
 * B5c2 — the dedicated per-unit menu section kinds. For `wheel` / `glass` the Step-4 section key
 * equals the category; for `other_coating` (GDA-OTHER-COATINGS-R1 C4) the section key is
 * `otherCoating` — callers map kind → key explicitly and never compute it from the string.
 */
export type WizardReviewDedicatedMenuKind = "wheel" | "glass" | "other_coating";

/** B5c2 — stable reference to ONE selected dedicated menu (never a label, never an index). */
export type WizardReviewDedicatedMenuRef = {
  readonly kind: WizardReviewDedicatedMenuKind;
  readonly menuCode: string;
};

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
  /**
   * GDA-ESTIMATE-QUANTITY-POLICY-R1 (Stage A) — the SAME canonical quantity policy
   * `applyWizardReviewLineAdjustments` enforces (`reviewQuantityPolicyForLine`), annotated once by the
   * authoritative compute route so Screen 7 never guesses editability from label/category/kind:
   *   • bounds  → the quantity may be edited at final review within these configured bounds;
   *   • null    → the quantity is fixed by the authoritative route (body coating, topcoats, full /
   *               front-full PPF, window film, maintenance, non-quantity options, …); a partial PPF
   *               PART line (Stage B) carries its configured bounds plus `ppfPartCode`; a DEDICATED
   *               wheel / glass menu line (B5c2) carries its configured bounds plus `dedicatedMenu`;
   *   • absent  → not annotated (a result that did not pass through the compute route); the UI
   *               treats it EXACTLY like null (fail closed: no editable quantity).
   * DISPLAY-ONLY: pricing and save validation never read this field — they re-resolve the policy.
   */
  quantityPolicy?: WizardReviewQuantityBounds | null;
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
  couponTotal:     number | null; // engine-applied configured coupon amount
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
  INVALID_REVIEW_ADJUSTMENT:      "INVALID_REVIEW_ADJUSTMENT",
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
