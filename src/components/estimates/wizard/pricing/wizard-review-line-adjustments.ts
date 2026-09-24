import { calculateEstimateTotals, lineTotal } from "@/lib/pricing/canonical-pricing-engine";
import { percentOfYen, percentageDiscountToYen } from "@/lib/pricing/configured-coupon-total";
import type { ResolvedCouponApplication } from "@/lib/pricing/configured-coupon-total";
import type { ConfigPricingInputBundle } from "./wizard-pricing-input-adapter-config";
import { wizardPricingLineId } from "./wizard-line-order";
import { WIZARD_PRICING_ERRORS, type WizardPricingResult } from "./wizard-pricing-types";

export type WizardReviewLineAdjustments = {
  readonly quantityInputsByLine: Readonly<Record<string, string>>;
  readonly unitPriceInputsByLine: Readonly<Record<string, string>>;
};

const parsePositiveInteger = (raw: string): number | null => {
  if (!/^[1-9]\d*$/.test(raw)) return null;
  const value = Number(raw);
  return Number.isSafeInteger(value) ? value : null;
};

const parseYen = (raw: string): number | null => {
  if (!/^\d+$/.test(raw)) return null;
  const value = Number(raw);
  return Number.isSafeInteger(value) ? value : null;
};

export function resolvedCouponApplicationsForSubtotal(
  applications: readonly ResolvedCouponApplication[], subtotal: number,
): readonly ResolvedCouponApplication[] {
  return applications.map((application) => ({
    ...application,
    appliedAmount: application.valueKind === "amount"
      ? application.valueRaw
      : percentOfYen(subtotal, application.valueRaw),
  }));
}

export function resolvedPpfCoatingReductionForLines(
  lines: readonly WizardPricingResult["lines"][number][],
  bundle: Pick<ConfigPricingInputBundle, "ppfAdjustmentsByIdentity">,
): number {
  const coatingTotal = lines
    .filter((line) => line.kind === "catalog" && line.category === "coating" &&
      (line.catalogLineRole === "base" || line.catalogLineRole === "topcoat2" || line.catalogLineRole === "topcoat3"))
    .reduce((sum, line) => sum + (line.lineTotal ?? 0), 0);
  const adjustment = Object.values(bundle.ppfAdjustmentsByIdentity)[0];
  if (adjustment === undefined) return 0;
  return Math.min(
    coatingTotal,
    adjustment.adjustmentType === "amount"
      ? adjustment.adjustmentValue
      : Math.round(coatingTotal * adjustment.adjustmentValue / 10_000),
  );
}

function invalidResult(base: WizardPricingResult): WizardPricingResult {
  return {
    ...base,
    status: "error",
    completeness: "error",
    subtotal: null,
    discountTotal: null,
    taxableSubtotal: null,
    taxTotal: null,
    grandTotal: null,
    errors: [...base.errors, {
      code: WIZARD_PRICING_ERRORS.INVALID_REVIEW_ADJUSTMENT,
      category: null,
      sourceId: null,
      message: "明細の数量は1以上の整数、金額は0以上の整数で入力してください。",
    }],
  };
}

/**
 * Apply final-review line edits before document-level discounts and tax.
 * The result stays pure and is executed by both browser preview and server save recomputation.
 */
export function applyWizardReviewLineAdjustments(
  base: WizardPricingResult,
  bundle: ConfigPricingInputBundle,
  adjustments: WizardReviewLineAdjustments,
): WizardPricingResult {
  const hasAdjustments =
    Object.keys(adjustments.quantityInputsByLine).length > 0 ||
    Object.keys(adjustments.unitPriceInputsByLine).length > 0;
  if (!hasAdjustments || base.lines.length === 0 || base.status === "error") return base;

  let invalid = false;
  const lines = base.lines.map((line) => {
    const id = wizardPricingLineId(line);
    const quantityRaw = adjustments.quantityInputsByLine[id];
    const unitPriceRaw = adjustments.unitPriceInputsByLine[id];
    if (quantityRaw === undefined && unitPriceRaw === undefined) return line;

    const quantity = quantityRaw === undefined ? line.quantity : parsePositiveInteger(quantityRaw);
    const unitPrice = unitPriceRaw === undefined ? line.unitPrice : parseYen(unitPriceRaw);
    if (quantity === null || unitPrice === null) {
      invalid = true;
      return line;
    }
    const extended = lineTotal(quantity, unitPrice, 0);
    return { ...line, quantity, unitPrice, lineSubtotal: extended, lineTotal: extended };
  });
  if (invalid) return invalidResult(base);

  const subtotal = lines.reduce((sum, line) => sum + (line.lineTotal ?? 0), 0);
  const couponApplications = resolvedCouponApplicationsForSubtotal(bundle.couponApplications, subtotal);
  const couponTotal = couponApplications.reduce((sum, application) => sum + application.appliedAmount, 0);
  const authoredDiscount = bundle.discountIntent.mode === "fixed_amount"
    ? bundle.discountIntent.amount
    : bundle.discountIntent.mode === "percentage"
      ? percentageDiscountToYen(subtotal, bundle.discountIntent.percentage)
      : 0;
  const dealerDiscount = bundle.discounts.isDealer
    ? Math.round(subtotal * (1 - bundle.discounts.dealerRate / 100))
    : 0;

  const ppfCoatingReduction = resolvedPpfCoatingReductionForLines(lines, bundle);

  const totals = calculateEstimateTotals(
    lines.map((line) => ({ quantity: line.quantity, unit_price: line.unitPrice ?? 0, discount_rate: 0 })),
    authoredDiscount + couponTotal + dealerDiscount + ppfCoatingReduction,
    bundle.taxRate,
  );

  return {
    ...base,
    lines,
    subtotal: totals.subtotal,
    discountTotal: totals.discount_amount,
    couponTotal,
    taxableSubtotal: totals.subtotal,
    taxTotal: totals.tax_amount,
    grandTotal: totals.total,
  };
}
