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

/** A catalog line's identity must be a real, non-empty, non-whitespace string. Validated, never trimmed. */
function isValidCatalogId(v: string | null): v is string {
  return typeof v === "string" && v.trim() !== "";
}

export function mapProductionResultToWizard(
  result: EstimateResult,
  bundle: WizardPricingInputBundle,
): WizardPricingResult {
  // Catalog lines — from the engine's authoritative coating line items. Each MUST carry BOTH the
  // engine's STABLE pricing_reference_id AND its semantic catalog_line_role (never the label/sourceId/
  // index/sort_order). A projected catalog line missing EITHER identity component FAILS CLOSED as a
  // WHOLE RESULT: no catalog line is ever emitted without both, no partial/success is returned, and no
  // numeric total is retained. Values are validated (id non-empty/non-whitespace) but NEVER trimmed,
  // invented, or derived.
  const catalogLines: WizardPricingLineResult[] = [];
  for (const svc of result.services) {
    if (svc.type !== "coating") continue;
    for (const it of svc.lineItems) {
      const refId = it.pricing_reference_id;
      const role = it.catalog_line_role;
      if (!isValidCatalogId(refId) || role === null) {
        const code = WIZARD_PRICING_ERRORS.UNKNOWN_PRICING_REFERENCE;
        const message = "カタログ明細の識別子がありません。";
        return {
          status: "error",
          completeness: "error",
          currency: "JPY",
          lines: [],
          unresolvedItems: [{ category: it.category, sourceId: null, code, message }],
          subtotal: null,
          discountTotal: null,
          couponTotal: 0,
          taxableSubtotal: null,
          taxTotal: null,
          grandTotal: null,
          warnings: bundle.warnings,
          errors: [...bundle.errors, { code, category: it.category, sourceId: null, message }],
          couponState: bundle.couponState,
          discountIntent: bundle.discountIntent,
        };
      }
      // `refId` narrowed to non-empty string, `role` narrowed to CatalogLineRole — exactly what the
      // catalog variant requires.
      catalogLines.push({
        kind:           "catalog",
        category:       it.category,
        sourceId:       `${it.category}:${it.item_name}`,
        pricingReferenceId: refId,
        catalogLineRole: role,
        label:          it.item_name,
        quantity:       it.quantity,
        unitPrice:      it.unit_price,
        lineSubtotal:   lineTotal(it.quantity, it.unit_price, 0),
        discountAmount: null,
        taxAmount:      null,
        lineTotal:      lineTotal(it.quantity, it.unit_price, it.discount_rate),
      });
    }
  }

  // Manual lines — surfaced from the resolved operator amounts (identical extended price to the value
  // passed into canonical aggregation, so the displayed lines and the engine subtotal always agree).
  const manualLines: WizardPricingLineResult[] = bundle.manualLines.map((l) => {
    const extended = Math.round(l.unitPrice * l.quantity);
    return {
      kind:           "manual" as const,
      category:       l.sourceCategory,
      sourceId:       `${l.sourceCategory}:${l.manualPricingIdentity}`,
      pricingReferenceId: null, // manual lines never carry a catalog identity
      catalogLineRole: null,    // …nor a catalog role
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
