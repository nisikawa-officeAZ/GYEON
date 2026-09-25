// GDA-ESTIMATE-PR123-R2 — final-review line adjustments (PURE, server-safe).
//
// Screen 7 lets the operator edit the quantity and tax-exclusive unit price of an ALREADY PRICED
// line, keyed by the same stable line identity the persisted order uses. This module applies those
// edits on top of the authoritative `WizardPricingResult` and recomputes the document totals through
// the SAME canonical engine (`calculateEstimate`) and the SAME percent/coupon/PPF-reduction helpers
// the unadjusted route uses, so:
//   - identity edits (unchanged quantity/unit price) reproduce the canonical result exactly;
//   - the result carries the SAME persisted semantic fields as the unadjusted route: `couponTotal` is
//     ONLY the coupon, and `discountTotal` is the engine-APPLIED combined document discount
//     (`EstimateResult.documentDiscount` = authored discount + PPF reduction + coupon, clamped, the
//     coupon counted exactly once) — `grandTotal = subtotal + tax − discountTotal`, and nothing on the
//     preview or save path ever subtracts `couponTotal` a second time;
//   - it never prices anything the authoritative route left unpriced (no line is created here);
//   - (GDA-ESTIMATE-PR133 P2-1) a quantity CHANGE obeys the SAME canonical manual option policy the
//     authoritative builder enforces: only a manual line whose source carries
//     `metadata.quantityRequired === true` AND whose configured store-global option is
//     `quantityRequired` may change quantity, and only within that option's configured
//     `minQuantity`/`maxQuantity`. Every other quantity change fails the whole result closed.
//
// It is NOT a second pricing engine: no tax, rounding, clamping or dealer arithmetic lives here.

import { calculateEstimate, lineTotal } from "@/lib/pricing/canonical-pricing-engine";
import type { PricingCatalog } from "@/lib/pricing/pricing-catalog";
import { percentOfYen, percentageDiscountToYen } from "@/lib/pricing/configured-coupon-total";
import type { ResolvedCouponApplication } from "@/lib/pricing/configured-coupon-total";
import { resolveGlobalPpfCoatingAdjustment } from "@/lib/wizard-catalog/ppf-coating-adjustment-core";
import type { ConfigPricingInputBundle } from "./wizard-pricing-input-adapter-config";
import type { ProductionPricingConfiguration } from "./wizard-manual-pricing-config";
import { wizardPricingLineId } from "./wizard-line-order";
import { WIZARD_PRICING_ERRORS, type WizardPricingLineResult, type WizardPricingResult } from "./wizard-pricing-types";

export type WizardReviewLineAdjustments = {
  readonly quantityInputsByLine: Readonly<Record<string, string>>;
  readonly unitPriceInputsByLine: Readonly<Record<string, string>>;
};

/** Quantity: a positive safe integer written in plain digits. Anything else fails closed. */
const parsePositiveInteger = (raw: string): number | null => {
  if (!/^[1-9]\d*$/.test(raw)) return null;
  const value = Number(raw);
  return Number.isSafeInteger(value) ? value : null;
};

/** Unit price: a non-negative safe integer yen amount written in plain digits. */
const parseYen = (raw: string): number | null => {
  if (!/^\d+$/.test(raw)) return null;
  const value = Number(raw);
  return Number.isSafeInteger(value) ? value : null;
};

/**
 * The per-coupon snapshot re-resolved against a (possibly adjusted) subtotal, with EXACTLY the rule
 * `resolveConfiguredCoupons` applies: an amount coupon is its authored yen; a percent coupon is
 * `percentOfYen(subtotal, basisPoints)`. Same subtotal ⇒ byte-identical applications.
 */
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

/** Body-coating base for the PPF reduction: base + layer 2 + layer 3 — never options, never PPF. */
function coatingLayersTotal(lines: readonly WizardPricingLineResult[]): number {
  return lines
    .filter((line) => line.kind === "catalog" && line.category === "coating"
      && (line.catalogLineRole === "base" || line.catalogLineRole === "topcoat2" || line.catalogLineRole === "topcoat3"))
    .reduce((sum, line) => sum + (line.lineTotal ?? 0), 0);
}

/**
 * The PPF + coating reduction for the given lines, re-derived per resolved adjustment through the
 * SAME canonical resolver the input adapter used (`resolveGlobalPpfCoatingAdjustment`). EVERY
 * resolved identity contributes — never only the first object value — and the sum is clamped to the
 * coating base so a reduction can never exceed what it reduces. Unchanged coating ⇒ unchanged yen.
 */
export function resolvedPpfCoatingReductionForLines(
  lines: readonly WizardPricingLineResult[],
  bundle: Pick<ConfigPricingInputBundle, "ppfAdjustmentsByIdentity">,
): number {
  const base = coatingLayersTotal(lines);
  if (base <= 0) return 0;
  let total = 0;
  for (const adjustment of Object.values(bundle.ppfAdjustmentsByIdentity)) {
    const resolved = resolveGlobalPpfCoatingAdjustment([{
      ruleId: adjustment.ruleId,
      ppfMethodCode: adjustment.ppfMethodCode,
      coatingCode: adjustment.coatingCode,
      adjustmentType: adjustment.adjustmentType,
      adjustmentValue: adjustment.adjustmentValue,
      isActive: true,
    }], base);
    total += resolved?.reductionYen ?? 0;
  }
  return Math.min(total, Math.round(base));
}

/** Configured quantity bounds a review quantity edit must satisfy (`maxQuantity` null = unbounded). */
export type WizardReviewQuantityBounds = {
  readonly minQuantity: number;
  readonly maxQuantity: number | null;
};

/**
 * The canonical quantity policy for a priced line, or `null` when the line's quantity may NOT be
 * changed at final review. Resolution is fail-closed and never inferred from a label or index:
 *   1. only a `manual` line can carry a quantity rule (catalog lines are engine-priced, quantity 1);
 *   2. the line must correlate to an authoritative bundle manual source line by the SAME
 *      `${sourceCategory}:${manualPricingIdentity}` identity the save mapper uses;
 *   3. that source line must carry `metadata.quantityRequired === true` — the ONLY builder that sets
 *      it is the store-global-option path of `buildManualPricingLinesFromConfig`;
 *   4. the configured `ProductionStoreGlobalOption` must exist, be priceable and be `quantityRequired`,
 *      and it supplies the bounds — the same bounds the builder validated the draft quantity against.
 */
export function reviewQuantityPolicyForLine(
  line: WizardPricingLineResult,
  bundle: Pick<ConfigPricingInputBundle, "manualLines">,
  pricingConfig: ProductionPricingConfiguration,
): WizardReviewQuantityBounds | null {
  if (line.kind !== "manual") return null;
  const source = bundle.manualLines.find((m) =>
    m.sourceCategory === line.category && `${m.sourceCategory}:${m.manualPricingIdentity}` === line.sourceId);
  if (source === undefined || source.metadata.quantityRequired !== true) return null;
  if (source.sourceCategory !== "store_global_options") return null;
  const option = pricingConfig.storeGlobalOptions.find((o) => o.code === source.manualPricingIdentity);
  if (option === undefined || !option.priceable || !option.quantityRequired) return null;
  return { minQuantity: option.minQuantity, maxQuantity: option.maxQuantity };
}

const INVALID_ADJUSTMENT_MESSAGE = "明細の数量は1以上の整数、金額は0以上の整数で入力してください。";

function invalidResult(base: WizardPricingResult, message: string): WizardPricingResult {
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
      message,
    }],
  };
}

/**
 * Apply final-review line edits to an authoritative result. Stale identities are ignored; an edit
 * that does not parse — or a quantity CHANGE the canonical manual option policy does not allow —
 * fails the WHOLE result closed (null totals, `INVALID_REVIEW_ADJUSTMENT`). A quantity input equal
 * to the authoritative quantity is an identity (no override) and is accepted for every line, which
 * is exactly what the review screen pre-fills. Executed identically by browser preview and server
 * save recomputation; `pricingConfig` is REQUIRED so both enforce the configured min/max bounds.
 */
export function applyWizardReviewLineAdjustments(
  base: WizardPricingResult,
  bundle: ConfigPricingInputBundle,
  adjustments: WizardReviewLineAdjustments,
  catalog: PricingCatalog,
  pricingConfig: ProductionPricingConfiguration,
): WizardPricingResult {
  const hasAdjustments =
    Object.keys(adjustments.quantityInputsByLine).length > 0 ||
    Object.keys(adjustments.unitPriceInputsByLine).length > 0;
  if (!hasAdjustments || base.lines.length === 0 || base.status === "error") return base;

  let invalidMessage: string | null = null;
  const reject = (message: string) => { if (invalidMessage === null) invalidMessage = message; };
  const lines = base.lines.map((line) => {
    const id = wizardPricingLineId(line);
    const quantityRaw = adjustments.quantityInputsByLine[id];
    const unitPriceRaw = adjustments.unitPriceInputsByLine[id];
    if (quantityRaw === undefined && unitPriceRaw === undefined) return line;
    // A line the authoritative route left unpriced is never priced by a review edit.
    if (line.unitPrice === null || line.lineTotal === null) { reject(INVALID_ADJUSTMENT_MESSAGE); return line; }

    const quantity = quantityRaw === undefined ? line.quantity : parsePositiveInteger(quantityRaw);
    const unitPrice = unitPriceRaw === undefined ? line.unitPrice : parseYen(unitPriceRaw);
    if (quantity === null || unitPrice === null) { reject(INVALID_ADJUSTMENT_MESSAGE); return line; }

    // P2-1: a quantity CHANGE is governed by the canonical manual option policy — never by parsing
    // alone. No policy ⇒ the line's quantity is fixed by the authoritative route; a policy ⇒ the
    // configured bounds apply exactly as the builder applied them to the draft quantity.
    if (quantity !== line.quantity) {
      const policy = reviewQuantityPolicyForLine(line, bundle, pricingConfig);
      if (policy === null) {
        reject(`「${line.label}」の数量は変更できません。`);
        return line;
      }
      if (quantity < policy.minQuantity || (policy.maxQuantity !== null && quantity > policy.maxQuantity)) {
        const range = policy.maxQuantity === null
          ? `${policy.minQuantity}以上`
          : `${policy.minQuantity}〜${policy.maxQuantity}`;
        reject(`「${line.label}」の数量は${range}の範囲で入力してください。`);
        return line;
      }
    }
    const extended = lineTotal(quantity, unitPrice, 0);
    return { ...line, quantity, unitPrice, lineSubtotal: extended, lineTotal: extended };
  });
  if (invalidMessage !== null) return invalidResult(base, invalidMessage);

  // Document-level inputs re-derived for the adjusted subtotal with the SAME helpers the input
  // adapter used, then handed to the SAME engine. Coupon yen goes ONLY into `couponTotal`; the
  // authored discount and the PPF reduction go ONLY into `extraAmount` — exactly as the adapter does.
  // The engine then reports `couponDiscount` (coupon only) and `documentDiscount` (the applied,
  // clamped sum of both slots) — the same two fields the canonical result adapter copies verbatim.
  const subtotal = lines.reduce((sum, line) => sum + (line.lineTotal ?? 0), 0);
  const couponTotal = resolvedCouponApplicationsForSubtotal(bundle.couponApplications, subtotal)
    .reduce((sum, application) => sum + application.appliedAmount, 0);
  const authoredDiscount = bundle.discountIntent.mode === "fixed_amount"
    ? bundle.discountIntent.amount
    : bundle.discountIntent.mode === "percentage"
      ? percentageDiscountToYen(subtotal, bundle.discountIntent.percentage)
      : 0;
  const ppfCoatingReduction = resolvedPpfCoatingReductionForLines(lines, bundle);

  const result = calculateEstimate(
    [{ type: "other", items: lines.map((line) => ({ name: line.label, price: line.lineTotal as number })) }],
    {
      couponTotal,
      extraAmount: authoredDiscount + ppfCoatingReduction,
      isDealer: bundle.discounts.isDealer,
      dealerRate: bundle.discounts.dealerRate,
    },
    bundle.taxRate,
    catalog,
  );

  // Same field mapping as `mapProductionResultToWizard` — copied, never recomputed, never combined.
  return {
    ...base,
    lines,
    subtotal: result.subtotal,
    discountTotal: result.documentDiscount,
    couponTotal: result.couponDiscount,
    taxableSubtotal: result.taxableAmount,
    taxTotal: result.taxAmount,
    grandTotal: result.total,
  };
}
