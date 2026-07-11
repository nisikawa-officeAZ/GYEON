// Estimate Wizard Ver2.2 — Atomic RPC payload (Phase 11F).
//
// The canonical payload the FUTURE atomic RPC (`save_estimate_from_wizard`) will receive, matching
// docs/estimate-persistence-migration-spec.md. PURE construction: NO execution, NO SQL, NO Supabase,
// NO serialization hacks, NO dealer id (the server supplies dealer id separately, never the payload).
// Monetary values are copied from the already-computed request; nothing is recalculated here.

import type {
  EstimateSaveRequest, EstimateSaveCustomer, EstimateSaveVehicle,
  EstimateSaveNonPriceableSelection, EstimateSaveDiscountIntent,
} from "./estimate-save-dto";
import {
  WIZARD_CATEGORY_PRICING_POLICY, WIZARD_CATEGORY_MANUAL_POLICY, type WizardPricingCategory,
} from "../pricing/wizard-pricing-identity";

// A service line in RPC form: hybrid identity + a DB-safe `category` (allowed CHECK set) plus the true
// `wizardCategory` (incl. store_global_options). Amounts are passthrough from the pricing result.
// `pricingPolicy` / `manualPricePolicy` are the approved dedicated per-line policy columns.
export type EstimateSaveRpcServiceLine = {
  lineId:                string;
  category:              string;        // mapped to the estimate_items category CHECK set
  wizardCategory:        string;        // exact wizard category (store_global_options preserved)
  pricingSource:         "catalog" | "manual";
  pricingReferenceId:    string | null;
  manualPricingIdentity: string | null;
  pricingPolicy:         string;        // catalog_only / manual_only (per category)
  manualPricePolicy:     string;        // disabled / required
  optionReferenceIds:    string[];
  label:                 string;
  description:           string | null;
  quantity:              number;
  unitPrice:             number;
  lineTotal:             number;
  lineMetadata:          Record<string, string | number | boolean | null>;
};

export type EstimateSaveRpcPayload = {
  idempotencyKey:         string | null;
  customer:               EstimateSaveCustomer;
  vehicle:                EstimateSaveVehicle;
  services:               EstimateSaveRpcServiceLine[];
  nonPriceableSelections: EstimateSaveNonPriceableSelection[];
  discountIntent:         EstimateSaveDiscountIntent;
  discountAppliedAmount:  number | null;
  couponIntent:           { selectedCouponIds: string[]; status: "none" | "selected_not_priced" };
  couponAppliedAmount:    number | null; // always 0/null — coupons deferred
  pricingSnapshot: {
    currency:        "JPY";
    completeness:    string;
    subtotal:        number | null;
    discountTotal:   number | null;
    couponTotal:     number | null;
    taxableSubtotal: number | null;
    taxRatePercent:  number;
    taxTotal:        number | null;
    grandTotal:      number | null;
    warnings:        { code: string; message: string }[];
    errors:          { code: string; message: string }[];
  };
  notes:    { customerNotes: string; internalMemo: string };
  metadata: EstimateSaveRequest["metadata"];
};

// wizard category → estimate_items.category (allowed CHECK set). store_global_options has no allowed
// value, so it maps to 'other' while the true category is kept in wizardCategory (per 11F-A spec).
const CATEGORY_MAP: Record<string, string> = {
  coating:              "coating",
  ppf:                  "ppf",
  window:               "window",
  maintenance:          "maintenance",
  carwash:              "carwash",
  roomclean:            "roomclean",
  other:                "other",
  store_global_options: "other",
};
function toDbCategory(wizardCategory: string): string {
  return CATEGORY_MAP[wizardCategory] ?? "other";
}
function pricingPolicyOf(wizardCategory: string): string {
  return WIZARD_CATEGORY_PRICING_POLICY[wizardCategory as WizardPricingCategory] ?? "manual_only";
}
function manualPricePolicyOf(wizardCategory: string): string {
  return WIZARD_CATEGORY_MANUAL_POLICY[wizardCategory as WizardPricingCategory] ?? "required";
}

/** Build the canonical RPC payload from a validated save request. Deterministic; no side effects. */
export function buildEstimateSaveRpcPayload(
  request: EstimateSaveRequest,
  opts: { idempotencyKey: string | null },
): EstimateSaveRpcPayload {
  return {
    idempotencyKey: opts.idempotencyKey,
    customer: request.customer,
    vehicle: request.vehicle,
    services: request.services.map((s) => ({
      lineId:                s.lineId,
      category:              toDbCategory(s.category),
      wizardCategory:        s.category,
      pricingSource:         s.pricingSource,
      pricingReferenceId:    s.pricingReferenceId,
      manualPricingIdentity: s.manualPricingIdentity,
      pricingPolicy:         pricingPolicyOf(s.category),
      manualPricePolicy:     manualPricePolicyOf(s.category),
      optionReferenceIds:    s.selectedOptionReferenceIds,
      label:                 s.label,
      description:           s.description,
      quantity:              s.quantity,
      unitPrice:             s.unitPrice,
      lineTotal:             s.subtotal,
      lineMetadata:          s.metadata,
    })),
    nonPriceableSelections: request.nonPriceableSelections,
    discountIntent:         request.discount.intent,
    discountAppliedAmount:  request.discount.appliedAmount,
    couponIntent:           { selectedCouponIds: request.coupon.selectedCouponIds, status: request.coupon.status },
    couponAppliedAmount:    request.coupon.appliedAmount,
    pricingSnapshot: {
      currency:        request.pricing.currency,
      completeness:    request.pricing.completeness,
      subtotal:        request.pricing.subtotal,
      discountTotal:   request.pricing.discountTotal,
      couponTotal:     request.pricing.couponTotal,
      taxableSubtotal: request.pricing.taxableSubtotal,
      taxRatePercent:  request.pricing.taxRatePercent,
      taxTotal:        request.pricing.taxTotal,
      grandTotal:      request.pricing.grandTotal,
      warnings:        request.pricing.warnings,
      errors:          request.pricing.errors,
    },
    notes:    request.notes,
    metadata: request.metadata,
  };
}
