// Estimate Wizard Ver2.2 — Production result → Wizard pricing result adapter (Phase 10D).
//
// Maps the production `EstimateResult` into the Wizard-facing `WizardPricingResult`. Every number
// comes from the production engine; the only per-line figure uses the engine's own `lineTotal`
// helper (the authoritative function — not Wizard arithmetic). Coupons are always 0. No side effects.

import { lineTotal } from "@/lib/pricing/canonical-pricing-engine";
import type { EstimateResult } from "@/lib/pricing/canonical-pricing-engine";
import type { WizardPricingInputBundle } from "./wizard-pricing-input-adapter";
import type { WizardPricingResult, WizardPricingLineResult, WizardPricingStatus } from "./wizard-pricing-types";

export function mapProductionResultToWizard(
  result: EstimateResult,
  bundle: WizardPricingInputBundle,
): WizardPricingResult {
  const lines: WizardPricingLineResult[] = result.services.flatMap((svc) =>
    svc.lineItems.map((it) => ({
      sourceId:       `${it.category}:${it.item_name}`,
      label:          it.item_name,
      quantity:       it.quantity,
      unitPrice:      it.unit_price,
      lineSubtotal:   lineTotal(it.quantity, it.unit_price, 0),
      discountAmount: null, // document-level discount (not distributed to lines)
      taxAmount:      null, // document-level tax (not distributed to lines)
      lineTotal:      lineTotal(it.quantity, it.unit_price, it.discount_rate),
    })),
  );

  // Applied (clamped) document discount = subtotal − taxableAmount (engine-derived, not recomputed).
  const discountTotal = result.subtotal - result.taxableAmount;

  const status: WizardPricingStatus = !bundle.hasSelection
    ? "incomplete"
    : lines.length > 0
      ? "success"
      : "incomplete";

  return {
    status,
    currency: "JPY",
    lines,
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
