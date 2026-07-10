// Estimate Wizard Ver2.2 — Hybrid pricing identity contract (Phase 10F-R).
//
// Architect resolution (see docs/estimate-wizard-v2.2-hybrid-pricing-policy.md): the Wizard uses a
// HYBRID pricing identity model. A selected service is priced from EITHER an authoritative production
// catalog reference OR an authoritative operator-entered manual amount — never both, never neither.
//
// This module defines TYPES + the per-category policy maps ONLY. It performs NO arithmetic, holds NO
// price value, imports NO screen component / DB / API, and NEVER uses a label or an array index as
// identity. Manual identities always originate from a stable existing config/draft field.

import type { PricingPolicy, ManualPricePolicy } from "@/lib/pricing/canonical-pricing-engine";
import type { WizardServiceCategory } from "../draft/wizard-draft-types";

// Store Global Options are a cross-category selection, not a Screen-3 service category.
export type WizardPricingCategory = WizardServiceCategory | "store_global_options";

// ── Hybrid discriminated identity (§4) ───────────────────────────────────────────
// A priced service carries EXACTLY ONE identity source. `not_priceable` never affects totals.
export type WizardPricingIdentity =
  | { source: "catalog"; pricingReferenceId: string }
  | { source: "manual"; manualPricingIdentity: string }
  | { source: "not_priceable" };

// ── Manual pricing line input contract (§8) ──────────────────────────────────────
// Preserves the operator-entered unit price + approved quantity semantics. No inference, no zero
// substitution, no fixture price, no local tax/discount/coupon. `manualPricingIdentity` is a STABLE
// existing config/draft id — never a visible label, never an array index.
export type WizardManualPricingLineInput = {
  sourceCategory:        WizardPricingCategory;
  manualPricingIdentity: string;
  label:                 string;              // display only — NEVER used as identity
  quantity:              number;
  unitPrice:             number;
  optionIdentity:        string | null;
  metadata:              Record<string, string | number | boolean | null>;
};

// ── Pricing completeness (§18) ───────────────────────────────────────────────────
// A service is priceable when it has a valid catalog reference OR a valid manual identity + a valid
// required manual amount. `unavailable` = selection exists but nothing is priceable yet.
export type WizardPricingCompleteness = "complete" | "partial" | "unavailable" | "error";

// ── Approved Ver2.2 category pricing policy (§2) ──────────────────────────────────
// Coating is the ONLY authoritative-catalog category. Every other Ver2.2 category prices from the
// approved operator manual-input UI. Store Global Options resolve per-option (default manual_only;
// non-priceable operational options are classified at build time and excluded from totals).
export const WIZARD_CATEGORY_PRICING_POLICY: Record<WizardPricingCategory, PricingPolicy> = {
  coating:              "catalog_only",
  ppf:                  "manual_only",
  window:               "manual_only",
  maintenance:          "manual_only",
  carwash:              "manual_only",
  roomclean:            "manual_only",
  other:                "manual_only",
  store_global_options: "manual_only",
};

// Whether a required manual amount must exist for the category to be considered priced (§9).
export const WIZARD_CATEGORY_MANUAL_POLICY: Record<WizardPricingCategory, ManualPricePolicy> = {
  coating:              "disabled", // catalog-priced; no manual amount participates
  ppf:                  "required",
  window:               "required",
  maintenance:          "required",
  carwash:              "required",
  roomclean:            "required",
  other:                "required",
  store_global_options: "required",
};
