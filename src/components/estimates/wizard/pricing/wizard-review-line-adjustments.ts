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
import type { WizardManualPricingLineInput } from "./wizard-pricing-identity";
import { wizardPricingLineId } from "./wizard-line-order";
import {
  WIZARD_PRICING_ERRORS,
  type WizardPricingLineResult,
  type WizardPricingResult,
  type WizardReviewDedicatedMenuKind,
  type WizardReviewQuantityBounds,
} from "./wizard-pricing-types";

// GDA-ESTIMATE-QUANTITY-POLICY-R1 (Stage A): the bounds type now lives with the line contract so the
// presentation layer shares it; re-exported here so every existing importer keeps working unchanged.
export type { WizardReviewQuantityBounds } from "./wizard-pricing-types";

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

/** A configured quantity bound pair is well-formed: safe-integer min ≥ 1; max null or safe-integer ≥ min. */
function dedicatedBoundsWellFormed(min: unknown, max: unknown): min is number {
  if (typeof min !== "number" || !Number.isSafeInteger(min) || min < 1) return false;
  if (max !== null && (typeof max !== "number" || !Number.isSafeInteger(max) || max < min)) return false;
  return true;
}

/**
 * The configured bounds of ONE dedicated menu row, or `null` when the collection is absent, the code
 * is unknown, or (GDA-OTHER-COATINGS-R1 C4) the other-coating row is FIXED-ONE
 * (`quantityRequired: false`) — a fixed-one row never yields a policy, so its quantity stays 1 and
 * read-only. An other-coating row's absent `minQuantity` means 1, exactly as the C4 builder applied it.
 */
function configuredDedicatedMenuBounds(
  kind: WizardReviewDedicatedMenuKind,
  menuCode: string,
  pricingConfig: ProductionPricingConfiguration,
): { readonly minQuantity: unknown; readonly maxQuantity: unknown } | null {
  if (kind === "other_coating") {
    const row = pricingConfig.otherCoatingMenus?.find((m) => m.code === menuCode);
    if (row === undefined || row.quantityRequired !== true) return null;
    return { minQuantity: row.minQuantity ?? 1, maxQuantity: row.maxQuantity };
  }
  const menus = kind === "wheel" ? pricingConfig.wheelMenus : pricingConfig.glassMenus;
  const row = menus?.find((m) => m.code === menuCode);
  return row === undefined ? null : { minQuantity: row.minQuantity, maxQuantity: row.maxQuantity };
}

/**
 * B5c2 — resolve the dedicated wheel / glass menu policy from the B5c1 source line AND the
 * dealer-scoped configuration. Both must name the SAME stable menu code, the source must have been
 * built by the dedicated-menu path (`menuKind` = `<kind>_menu`), and BOTH must carry well-formed,
 * IDENTICAL bounds — a source whose bounds drifted from the configuration is stale and stays fixed.
 * GDA-OTHER-COATINGS-R1 (C4) — the SAME rule for a QUANTITY-BEARING `other_coating` menu line
 * (`menuKind` `other_coating_menu`, resolved against `otherCoatingMenus`); a row the dealer has
 * since made fixed-one, or an unknown / drifted / malformed row, ⇒ fixed (fail closed).
 */
function dedicatedMenuQuantityPolicy(
  kind: WizardReviewDedicatedMenuKind,
  source: WizardManualPricingLineInput,
  pricingConfig: ProductionPricingConfiguration,
): WizardReviewQuantityBounds | null {
  if (source.metadata.menuKind !== `${kind}_menu`) return null;
  const menuCode = source.manualPricingIdentity;
  if (typeof menuCode !== "string" || menuCode.trim() === "") return null;
  const configured = configuredDedicatedMenuBounds(kind, menuCode, pricingConfig);
  if (configured === null) return null;
  if (!dedicatedBoundsWellFormed(configured.minQuantity, configured.maxQuantity)) return null;
  const configuredMax = configured.maxQuantity as number | null;
  if (!dedicatedBoundsWellFormed(source.metadata.minQuantity, source.metadata.maxQuantity)) return null;
  if (source.metadata.minQuantity !== configured.minQuantity || source.metadata.maxQuantity !== configuredMax) return null;
  return { minQuantity: configured.minQuantity, maxQuantity: configuredMax, dedicatedMenu: { kind, menuCode } };
}

/**
 * The authoritative bundle manual source line a priced line correlates to, by the SAME
 * `${sourceCategory}:${manualPricingIdentity}` identity the save mapper uses — never by label or
 * index. `undefined` for a catalog line or an unmatched manual line (fail closed for every caller).
 */
function manualSourceForLine(
  line: WizardPricingLineResult,
  bundle: Pick<ConfigPricingInputBundle, "manualLines">,
): WizardManualPricingLineInput | undefined {
  if (line.kind !== "manual") return undefined;
  return bundle.manualLines.find((m) =>
    m.sourceCategory === line.category && `${m.sourceCategory}:${m.manualPricingIdentity}` === line.sourceId);
}

/**
 * GDA-OTHER-COATINGS-R1 (C5 F2) — TRUE only for a line whose VERIFIED source was built by the C4
 * other-coating path (`metadata.menuKind === "other_coating_menu"`). Such a line must keep a POSITIVE
 * unit price at final review — the same rule the B1 settings form and the C4 builder enforce — so a
 * ¥0 override is refused by preview AND save (same adjuster). Never inferred from label or category.
 */
function isOtherCoatingMenuLine(
  line: WizardPricingLineResult,
  bundle: Pick<ConfigPricingInputBundle, "manualLines">,
): boolean {
  return manualSourceForLine(line, bundle)?.metadata.menuKind === "other_coating_menu";
}

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
 * GDA-ESTIMATE-QUANTITY-POLICY-R1 (Stage B): a SERVER-REBUILT manual partial PPF PART line (source
 * `sourceCategory === "ppf"`, `metadata.ppfScope === "partial"`, string `ppfPartCode`) is editable
 * within the configured part bounds the adapter copied from the authoritative configuration
 * (`ppfPartMinQuantity`/`ppfPartMaxQuantity`), and carries `ppfPartCode` so the hook can write a valid
 * edit through to the canonical Step-4 quantity. Malformed bounds ⇒ fixed (fail closed). Full /
 * front-full PPF carry no part code and stay fixed.
 * GDA-ESTIMATE-QUANTITY-POLICY-R1 (B5c2, plan §24.1): a DEDICATED wheel / glass menu line (source
 * `sourceCategory` `wheel` | `glass`, `metadata.menuKind` `<category>_menu`, `quantityRequired: true`,
 * built ONLY by the B5c1 dedicated-menu path of `buildManualPricingLinesFromConfig`) is editable
 * ONLY when the dealer-scoped configuration (`wheelMenus` / `glassMenus`) still carries the SAME
 * stable menu code AND both sides agree on well-formed bounds. It carries `dedicatedMenu` so the hook
 * can write a valid edit through to the canonical Step-4 `quantitiesByMenu`. A stale / unknown /
 * disagreeing / malformed source or configuration ⇒ fixed (fail closed). Nothing here invents a
 * menu, a price, a bound or a line.
 * GDA-OTHER-COATINGS-R1 (C4): an `other_coating` menu line (built ONLY by the C4 other-coating path,
 * `metadata.menuKind` `other_coating_menu`) is editable ONLY when its dealer row is QUANTITY-BEARING
 * (`quantityRequired: true`) in `otherCoatingMenus` AND both sides agree on well-formed bounds; it
 * then carries `dedicatedMenu: { kind: "other_coating", menuCode }` so the hook writes a valid edit
 * through to the canonical Step-4 `services.otherCoating.quantitiesByMenu`. A FIXED-ONE row
 * (`quantityRequired: false`, priced at exactly 1) is never editable here.
 */
export function reviewQuantityPolicyForLine(
  line: WizardPricingLineResult,
  bundle: Pick<ConfigPricingInputBundle, "manualLines">,
  pricingConfig: ProductionPricingConfiguration,
): WizardReviewQuantityBounds | null {
  const source = manualSourceForLine(line, bundle);
  if (source === undefined) return null;
  if (source.sourceCategory === "ppf" && source.metadata.ppfScope === "partial" && typeof source.metadata.ppfPartCode === "string") {
    const min = source.metadata.ppfPartMinQuantity;
    const max = source.metadata.ppfPartMaxQuantity;
    if (typeof min !== "number" || !Number.isSafeInteger(min) || min < 1) return null;
    if (max !== null && (typeof max !== "number" || !Number.isSafeInteger(max) || max < min)) return null;
    return { minQuantity: min, maxQuantity: max, ppfPartCode: source.metadata.ppfPartCode };
  }
  if (source.metadata.quantityRequired !== true) return null;
  if (source.sourceCategory === "wheel" || source.sourceCategory === "glass" || source.sourceCategory === "other_coating") {
    return dedicatedMenuQuantityPolicy(source.sourceCategory, source, pricingConfig);
  }
  if (source.sourceCategory !== "store_global_options") return null;
  const option = pricingConfig.storeGlobalOptions.find((o) => o.code === source.manualPricingIdentity);
  if (option === undefined || !option.priceable || !option.quantityRequired) return null;
  return { minQuantity: option.minQuantity, maxQuantity: option.maxQuantity };
}

/**
 * GDA-ESTIMATE-QUANTITY-POLICY-R1 (Stage A) — annotate every line with the SAME canonical quantity
 * policy `applyWizardReviewLineAdjustments` enforces, so the final-review screen renders an editable
 * quantity ONLY where a quantity change would actually be accepted (and with the same bounds).
 *
 * Pure and display-only: it resolves each line through `reviewQuantityPolicyForLine` (never through a
 * label, index, kind alone, or a pre-existing `quantityPolicy` value), touches no price/quantity/total,
 * and returns a fresh result with fresh line objects — the input is never mutated. Pricing and save
 * validation do NOT read the annotation; they re-resolve the policy themselves, so a tampered or
 * stale annotation can never widen what the authoritative route accepts.
 */
export function annotateWizardReviewQuantityPolicies(
  result: WizardPricingResult,
  bundle: Pick<ConfigPricingInputBundle, "manualLines">,
  pricingConfig: ProductionPricingConfiguration,
): WizardPricingResult {
  return {
    ...result,
    lines: result.lines.map((line) => ({
      ...line,
      quantityPolicy: reviewQuantityPolicyForLine(line, bundle, pricingConfig),
    })),
  };
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

    // C5 F2: a verified other-coating menu line never prices at ¥0 — the new-kind positive-price rule
    // applies at review exactly as it does in settings and in the builder. Wheel / glass / store
    // option / every other kind keep their existing non-negative rule (0 still accepted) unchanged.
    if (unitPrice === 0 && isOtherCoatingMenuLine(line, bundle)) {
      reject(`「${line.label}」の単価は1以上の整数で入力してください。`);
      return line;
    }

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
