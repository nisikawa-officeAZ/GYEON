// Estimate Wizard Ver2.2 — Production result → Wizard pricing result adapter (Phase 10D → 10F-R).
//
// Maps the production `EstimateResult` into the Wizard-facing `WizardPricingResult` under the hybrid
// pricing model. Document totals (subtotal / tax / discount / grand total) come ENTIRELY from the
// production engine. Displayed lines are split by identity source: catalog lines come from the
// engine's coating line items; manual lines are surfaced from the resolved operator amounts. This
// adapter performs NO tax/discount/coupon arithmetic. Coupons are always 0.

import { lineTotal } from "@/lib/pricing/canonical-pricing-engine";
import type { EstimateResult } from "@/lib/pricing/canonical-pricing-engine";
import type { WizardPricingInputBundle } from "./wizard-pricing-input-adapter";
import type {
  WizardPricingResult, WizardPricingLineResult, WizardPricingStatus, WizardUnresolvedItem,
} from "./wizard-pricing-types";
import { WIZARD_PRICING_ERRORS } from "./wizard-pricing-types";
import type { WizardPricingCompleteness } from "./wizard-pricing-identity";

// Error codes that mark a SELECTED priceable service as unresolved (excluded from the total but never
// dropped). Discount-only issues (e.g. PERCENTAGE_NOT_SUPPORTED) are not item-level unresolved codes.
const UNRESOLVED_CODES: string[] = [
  WIZARD_PRICING_ERRORS.MANUAL_PRICE_REQUIRED,
  WIZARD_PRICING_ERRORS.MANUAL_PRICING_IDENTITY_MISSING,
  WIZARD_PRICING_ERRORS.INVALID_MANUAL_PRICE,
  WIZARD_PRICING_ERRORS.INVALID_QUANTITY,
  WIZARD_PRICING_ERRORS.UNKNOWN_PRICING_REFERENCE,
];
const INVALID_CODES: string[] = [
  WIZARD_PRICING_ERRORS.INVALID_MANUAL_PRICE,
  WIZARD_PRICING_ERRORS.INVALID_QUANTITY,
];

export function mapProductionResultToWizard(
  result: EstimateResult,
  bundle: WizardPricingInputBundle,
): WizardPricingResult {
  // Catalog lines — from the engine's authoritative coating line items.
  const catalogLines: WizardPricingLineResult[] = result.services
    .filter((svc) => svc.type === "coating")
    .flatMap((svc) =>
      svc.lineItems.map((it) => ({
        kind:           "catalog" as const,
        category:       it.category,
        sourceId:       `${it.category}:${it.item_name}`,
        label:          it.item_name,
        quantity:       it.quantity,
        unitPrice:      it.unit_price,
        lineSubtotal:   lineTotal(it.quantity, it.unit_price, 0),
        discountAmount: null,
        taxAmount:      null,
        lineTotal:      lineTotal(it.quantity, it.unit_price, it.discount_rate),
      })),
    );

  // Manual lines — surfaced from the resolved operator amounts (identical extended price to the value
  // passed into canonical aggregation, so the displayed lines and the engine subtotal always agree).
  const manualLines: WizardPricingLineResult[] = bundle.manualLines.map((l) => {
    const extended = Math.round(l.unitPrice * l.quantity);
    return {
      kind:           "manual" as const,
      category:       l.sourceCategory,
      sourceId:       `${l.sourceCategory}:${l.manualPricingIdentity}`,
      label:          l.label,
      quantity:       l.quantity,
      unitPrice:      l.unitPrice,
      lineSubtotal:   extended,
      discountAmount: null,
      taxAmount:      null,
      lineTotal:      extended,
    };
  });

  const lines = [...catalogLines, ...manualLines];

  const unresolvedItems: WizardUnresolvedItem[] = bundle.errors
    .filter((e) => UNRESOLVED_CODES.includes(e.code))
    .map((e) => ({ category: e.category ?? "—", sourceId: e.sourceId, code: e.code, message: e.message }));

  const hasInvalid = bundle.errors.some((e) => INVALID_CODES.includes(e.code));
  const pricedCount = lines.length;

  const completeness: WizardPricingCompleteness = !bundle.hasSelection
    ? "unavailable"
    : hasInvalid
      ? "error"
      : pricedCount > 0 && unresolvedItems.length > 0
        ? "partial"
        : pricedCount > 0
          ? "complete"
          : "unavailable";

  const status: WizardPricingStatus =
    completeness === "error" ? "error" : pricedCount > 0 ? "success" : "incomplete";

  // Applied (clamped) document discount = subtotal − taxableAmount (engine-derived, not recomputed).
  const discountTotal = result.subtotal - result.taxableAmount;

  return {
    status,
    completeness,
    currency: "JPY",
    lines,
    unresolvedItems,
    subtotal:        result.subtotal,
    discountTotal,
    couponTotal:     0,
    taxableSubtotal: result.taxableAmount,
    taxTotal:        result.taxAmount,
    grandTotal:      result.total,
    warnings:        bundle.warnings,
    errors:          bundle.errors,
    couponState:     bundle.couponState,
    discountIntent:  bundle.discountIntent,
  };
}
