// Estimate Wizard Ver2.2 — CONFIG-DRIVEN pricing input adapter (Phase 8-B2F-B).
//
// PURE. No React, no server module, no DB, no API, no `any`, no cast. **NO FIXTURE IMPORT.**
//
// The production twin of `wizard-pricing-input-adapter.ts`. It builds the production engine's
// `ServiceInput[]` + `DiscountInput` from the canonical draft — identically — except that the manual
// lines come from `buildManualPricingLinesFromConfig` (authoritative labels, no `?? id` fallback)
// instead of the fixture-backed builder.
//
// ── WHAT IS IDENTICAL, AND WHY THAT MATTERS ─────────────────────────────────────
// Coating resolution, the trade-rate rules and the tax rate are copied verbatim. No tax, rounding,
// discount ORDER, total, or rank coefficient is computed or moved here — every number still
// originates from the production engine. The test suite pins price equivalence against the fixture
// path for identical inputs.
//
// ── B1.1: WHAT CHANGED, AND WHAT DELIBERATELY DID NOT ───────────────────────────
// `calculateEstimate` remains the production authority and its sum-then-clamp discount order, tax
// behaviour and rounding are UNCHANGED. What changed is only what this adapter puts INTO the
// engine's existing `DiscountInput` slots:
//
//   • a percentage discount is converted to yen against the engine-reported subtotal → extraAmount
//   • configured coupons are resolved to a single yen total                          → couponTotal
//   • PPF lines carry their dealer coefficient and PPF+coating reduction in unitPrice
//
// The two refusals this used to raise (PERCENTAGE_NOT_SUPPORTED, COUPON_PRICING_NOT_IMPLEMENTED)
// are therefore no longer correct and are gone. Every OTHER fail-closed path is preserved, and a
// coupon set that cannot be resolved still fails closed rather than pricing as zero.
//
// ── ONE DELIBERATE DIFFERENCE, AND WHY IT IS SAFE ───────────────────────────────
// The fixture adapter validates the coating id against a projection built from
// `DEFAULT_PRICING_CATALOG` + `FIXTURE_PRESENTATION_METADATA`. Importing that would defeat the
// purpose of this module. It is also unnecessary: the projection sets `pricingReferenceId = id`
// (project-production-catalog.ts:72), so membership in the projection is exactly membership in
// `catalog.coatings`. We therefore validate against the CALLER'S `PricingCatalog` directly — which is
// both fixture-free and strictly better, because it is the dealer's real catalog rather than the
// module-level default. `makePricingCatalog` only overlays PRICES onto the fixed default item set, so
// the id set is identical either way and the two paths cannot disagree.

import type { PricingCatalog } from "@/lib/pricing/pricing-catalog";
import { calculateEstimate } from "@/lib/pricing/canonical-pricing-engine";
import {
  resolveConfiguredCoupons,
  percentageDiscountToYen,
  type ConfiguredCoupon,
  type ResolvedCouponApplication,
} from "@/lib/pricing/configured-coupon-total";
import {
  applyInstallCoefficientBp,
  resolvePpfCoatingAdjustment,
  type PpfCoatingAdjustmentRule,
  type ResolvedPpfCoatingAdjustment,
} from "@/lib/wizard-catalog/ppf-coating-adjustment-core";
import { toPricingCatalogCoatingId, toPricingCatalogTopcoatId } from "@/lib/pricing/wizard-coating-id-adapter";
import { validateCoatingSelection } from "./coating-selection-validation";
import type { ShopRank } from "../screens/step-types";
import type {
  ServiceInput,
  DiscountInput,
  PricingCouponState,
  PricingDiscountIntent,
} from "@/lib/pricing/canonical-pricing-engine";
import type { EstimateWizardDraftV22 } from "../draft/wizard-draft-types";
import type { WizardManualPricingLineInput } from "./wizard-pricing-identity";
import type { WizardPricingIssue } from "./wizard-pricing-types";
import { WIZARD_PRICING_ERRORS, WIZARD_PRICING_WARNINGS } from "./wizard-pricing-types";
import {
  buildManualPricingLinesFromConfig,
  type ProductionPricingConfiguration,
} from "./wizard-manual-pricing-config";

export type {
  ProductionPricingConfiguration,
  ProductionLabelOption,
  ProductionStoreGlobalOption,
} from "./wizard-manual-pricing-config";

const PRODUCTION_TAX_RATE = 10; // production default (estimate-totals default); Wizard has no tax UI.

/**
 * B1.1 — additive, OPTIONAL configuration extensions.
 *
 * Every field is optional, so an existing caller that passes a plain `ProductionPricingConfiguration`
 * still compiles and still behaves EXACTLY as before: no coupons, no coefficient, no adjustment.
 * This mirrors the additive-extension pattern already used by `pricing-contracts.ts`.
 */
export interface ConfiguredPricingRules {
  /** Dealer-authored coupons, projected from `wizard_catalog_items` (kind = 'coupon'). */
  readonly coupons?: readonly ConfiguredCoupon[];
  /** PPF/film code → installation coefficient in basis points (10000 = ×1.0). */
  readonly installCoefficientBpByCode?: Readonly<Record<string, number>>;
  /** Dealer-scoped PPF + coating reduction rules. */
  readonly ppfCoatingAdjustments?: readonly PpfCoatingAdjustmentRule[];
  /** ISO `YYYY-MM-DD` used for coupon validity. Supplied by the caller — this module reads no clock. */
  readonly calculationDate?: string;
}

export type ConfiguredPricingConfiguration = ProductionPricingConfiguration & ConfiguredPricingRules;

export interface ConfigPricingInputBundle {
  services:        ServiceInput[];
  manualLines:     WizardManualPricingLineInput[];
  catalogResolved: boolean;
  discounts:       DiscountInput;
  taxRate:         number;
  warnings:        WizardPricingIssue[];
  errors:          WizardPricingIssue[];
  couponState:     PricingCouponState;
  discountIntent:  PricingDiscountIntent;
  hasSelection:    boolean;
  /**
   * B1.1 — resolved SNAPSHOT VALUES. `PricingCouponState` (a shared contract this phase may not
   * change) cannot express "priced", so the truth of what was actually applied lives here and
   * `couponState` stays `none` once coupons resolve cleanly. It remains `selected_not_priced`
   * only when a selection could NOT be resolved, which keeps that fail-closed signal meaningful.
   */
  couponApplications: readonly ResolvedCouponApplication[];
  /** The subtotal the percentage discount and percentage coupons were computed against. */
  discountBaseSubtotal: number;
  /** Resolved PPF coefficients/adjustments, keyed by manual-line identity, for the save snapshot. */
  ppfCoefficientBpByIdentity: Readonly<Record<string, number>>;
  ppfAdjustmentsByIdentity: Readonly<Record<string, ResolvedPpfCoatingAdjustment>>;
}

function issue(code: string, message: string, category: string | null = null, sourceId: string | null = null): WizardPricingIssue {
  return { code, category, sourceId, message };
}

/** Manual line → canonical "other" line item. Line COMPOSITION only; the engine owns every total. */
function manualLineExtendedPrice(l: WizardManualPricingLineInput): number {
  return Math.round(l.unitPrice * l.quantity);
}

export function buildWizardPricingInputFromConfig(
  draft: EstimateWizardDraftV22,
  config: ConfiguredPricingConfiguration,
  catalog: PricingCatalog,
  shopRank?: ShopRank,
): ConfigPricingInputBundle {
  const warnings: WizardPricingIssue[] = [];
  const errors: WizardPricingIssue[] = [];
  const services: ServiceInput[] = [];

  const cfg = draft.serviceConfiguration;
  const selected = draft.serviceSelection.selectedCategories;
  const sizeKey = draft.vehicle.bodySizeKey;

  // ── Coating (CATALOG path) — price and name owned by PricingCatalog. ──
  // Layer-1 translates to a base coatingId; explicit layer-2/3 translate to topcoat add-ons. Upper
  // layers are priced ONLY when a shopRank is supplied AND the selection is structurally valid AND
  // every add-on has an authoritative topcoatBase price — otherwise it fails closed (no partial
  // coating price). Without a rank, upper layers cannot be validated, so layer-1 is priced and the
  // rest flagged MULTI_LAYER_NOT_MAPPED (unchanged legacy behaviour).
  let catalogResolved = false;
  if (selected.includes("coating")) {
    const co = cfg.coating;
    if (co.layer1Id) {
      const coatingId = toPricingCatalogCoatingId(co.layer1Id);
      const layer1Priceable = coatingId !== null && catalog.coatings.some((c) => c.id === coatingId);
      const hasUpper = !!(co.layer2Id || co.layer3Id);
      const sizeWarn = () => { if (!sizeKey) warnings.push(issue(WIZARD_PRICING_WARNINGS.MISSING_BODY_SIZE, "ボディサイズが未選択のため、サイズ係数は既定値で計算されます。", "coating")); };
      if (!layer1Priceable || !coatingId) {
        errors.push(issue(WIZARD_PRICING_ERRORS.UNKNOWN_PRICING_REFERENCE, `コーティング「${co.layer1Id}」は本番カタログに対応する識別子がありません。`, "coating", co.layer1Id));
      } else if (shopRank === undefined) {
        // Rank unavailable: cannot validate rank/upper layers. Price layer-1; flag any upper as unmapped.
        sizeWarn();
        if (hasUpper) warnings.push(issue(WIZARD_PRICING_WARNINGS.MULTI_LAYER_NOT_MAPPED, "2層目・3層目は店舗ランク情報がないため計算に含まれていません。", "coating"));
        services.push({ type: "coating", coatingId, sizeKey, optionIds: [] });
        catalogResolved = true;
      } else {
        // Rank available: validate the FULL selection (layer-1 rank gate + upper matrix + certified).
        const valid = validateCoatingSelection(co.layer1Id, co.layer2Id, co.layer3Id, shopRank);
        const topcoat2 = co.layer2Id ? toPricingCatalogTopcoatId(co.layer2Id) : null;
        const topcoat3 = co.layer3Id ? toPricingCatalogTopcoatId(co.layer3Id) : null;
        const upperPriceable =
          (!co.layer2Id || (topcoat2 !== null && catalog.topcoatBase[topcoat2] !== undefined)) &&
          (!co.layer3Id || (topcoat3 !== null && catalog.topcoatBase[topcoat3] !== undefined));
        if (!valid.ok) {
          errors.push(issue(WIZARD_PRICING_ERRORS.UNKNOWN_PRICING_REFERENCE, valid.reason, "coating", co.layer1Id));
        } else if (!upperPriceable) {
          errors.push(issue(WIZARD_PRICING_ERRORS.UNKNOWN_PRICING_REFERENCE, "コーティング上層に対応する価格が本番カタログにありません。", "coating", co.layer2Id ?? co.layer3Id));
        } else {
          sizeWarn();
          services.push({ type: "coating", coatingId, sizeKey, optionIds: [], ...(topcoat2 ? { topcoat2 } : {}), ...(topcoat3 ? { topcoat3 } : {}) });
          catalogResolved = true;
        }
      }
    }
  }

  // ── Manual categories — AUTHORITATIVE labels only. ─────────────────────────────
  const manual = buildManualPricingLinesFromConfig(draft, config);
  warnings.push(...manual.warnings);
  errors.push(...manual.errors);

  // ── B1.1: PPF installation coefficient + PPF/coating reduction ────────────────
  // Applied to the PPF line's UNIT PRICE, so it composes with quantity exactly like every other
  // line and the engine still owns every total. Both resolved values are recorded per line so the
  // save mapper can freeze them into the estimate snapshot as VALUES, not as rule references.
  const coeffByCode = config.installCoefficientBpByCode ?? {};
  const adjustmentRules = config.ppfCoatingAdjustments ?? [];
  const coatingCode = draft.serviceConfiguration.coating.layer1Id ?? null;
  const ppfCoefficientBpByIdentity: Record<string, number> = {};
  const ppfAdjustmentsByIdentity: Record<string, ResolvedPpfCoatingAdjustment> = {};

  const manualLines: WizardManualPricingLineInput[] = manual.lines.map((l) => {
    if (l.sourceCategory !== "ppf") return l;

    const bp = coeffByCode[l.manualPricingIdentity];
    // An unknown identity yields `undefined` → the coefficient helper returns the IDENTITY, so an
    // unconfigured PPF line prices exactly as it does today. Never a silent zero, never a discount.
    const coefficientApplied = applyInstallCoefficientBp(l.unitPrice, bp ?? null);

    const adjustment = resolvePpfCoatingAdjustment(
      l.manualPricingIdentity,
      coatingCode,
      adjustmentRules,
      coefficientApplied,
    );
    const unitPrice = Math.max(0, coefficientApplied - (adjustment?.reductionYen ?? 0));

    if (bp !== undefined) ppfCoefficientBpByIdentity[l.manualPricingIdentity] = bp;
    if (adjustment) ppfAdjustmentsByIdentity[l.manualPricingIdentity] = adjustment;

    if (unitPrice === l.unitPrice) return l;
    return {
      ...l,
      unitPrice,
      metadata: {
        ...l.metadata,
        ...(bp !== undefined ? { ppfInstallCoefficientBp: bp } : {}),
        ...(adjustment
          ? {
              ppfCoatingAdjustmentRuleId: adjustment.ruleId,
              ppfCoatingAdjustmentType: adjustment.adjustmentType,
              ppfCoatingAdjustmentValue: adjustment.adjustmentValue,
              ppfCoatingAdjustmentReductionYen: adjustment.reductionYen,
              ppfCoatingAdjustmentCoatingCode: adjustment.coatingCode,
            }
          : {}),
      },
    };
  });

  if (manualLines.length > 0) {
    services.push({ type: "other", items: manualLines.map((l) => ({ name: l.label, price: manualLineExtendedPrice(l) })) });
  }

  // ── Discount base subtotal (B1.1) ─────────────────────────────────────────────
  // A percentage discount and a percentage coupon both need a defined base, and the engine is the
  // only authority for what the subtotal IS. So we ask it, with every discount zeroed, and use the
  // subtotal it reports. This module still computes no subtotal of its own: the number below comes
  // from `calculateEstimate`, exactly like every other figure on this path.
  const discountBaseSubtotal =
    services.length > 0
      ? calculateEstimate(
          services,
          { couponTotal: 0, extraAmount: 0, isDealer: false, dealerRate: 0 },
          PRODUCTION_TAX_RATE,
          catalog,
        ).subtotal
      : 0;

  // ── Discount / coupon ─────────────────────────────────────────────────────────
  // B1.1 converts BOTH upstream into the engine's existing `DiscountInput` slots. The engine's
  // sum-then-clamp order, tax behaviour and rounding are untouched.
  const dc = draft.discountAndCoupon;
  const nc = draft.customer.newCustomer;
  let extraAmount = 0;
  let discountIntent: PricingDiscountIntent = { mode: "none" };
  if (dc.mode === "amount") {
    const amt = Number(dc.amountInput);
    if (dc.amountInput.trim() !== "" && Number.isFinite(amt) && amt > 0) {
      extraAmount = amt;
      discountIntent = { mode: "fixed_amount", amount: amt };
    }
  } else if (dc.mode === "percent") {
    if (dc.percentInput.trim() !== "") {
      const pct = Number(dc.percentInput) || 0;
      discountIntent = { mode: "percentage", percentage: pct };
      // Converted to yen against the defined subtotal, then fed to `extraAmount`. An out-of-range
      // or malformed percentage converts to 0 rather than becoming a silent discount.
      if (!Number.isFinite(pct) || pct <= 0 || pct > 100) {
        errors.push(issue(WIZARD_PRICING_ERRORS.PERCENTAGE_NOT_SUPPORTED, "％値引きは0より大きく100以下で入力してください。", "discount"));
      } else {
        extraAmount = percentageDiscountToYen(discountBaseSubtotal, pct);
      }
    }
  }
  // dc.mode === "none": extraAmount stays 0, discountIntent stays { mode: "none" }, no error.

  // Trade (業者掛け率) discount — verbatim. An empty/zero/invalid rate must NOT become dealerRate=0,
  // which the engine reads as "dealer pays 0% → 100% off".
  const rawTradeRate = Number(nc.tradeRate);
  const hasValidTradeRate =
    nc.tradeRate.trim() !== "" &&
    Number.isFinite(rawTradeRate) &&
    rawTradeRate > 0 &&
    rawTradeRate <= 100;
  const isDealer = !!nc.isBusiness && hasValidTradeRate;
  const dealerRate = hasValidTradeRate ? rawTradeRate : 0;

  // ── Coupons (B1.1) — ALL selected ids, never just the first ───────────────────
  // Resolution is all-or-nothing: an unknown, inactive, expired, malformed or non-combinable
  // selection rejects the whole set, because a partially applied set would silently under-discount
  // a customer-visible quote. An unresolvable set keeps the pre-existing `selected_not_priced`
  // state, so the downstream fail-closed save guard still fires for exactly that case.
  const couponResolution = resolveConfiguredCoupons(
    dc.selectedCouponIds,
    config.coupons ?? [],
    discountBaseSubtotal,
    config.calculationDate ?? "",
  );

  let couponState: PricingCouponState = { status: "none" };
  let couponApplications: readonly ResolvedCouponApplication[] = [];
  let couponTotal = 0;

  if (couponResolution.ok) {
    couponApplications = couponResolution.applications;
    couponTotal = couponResolution.couponTotal;
  } else {
    couponState = {
      status: "selected_not_priced",
      couponId: couponResolution.unresolvedCouponIds[0] ?? dc.selectedCouponIds[0],
      label: "クーポン",
      warningCode: "COUPON_PRICING_NOT_IMPLEMENTED",
    };
    errors.push(issue(WIZARD_PRICING_ERRORS.UNKNOWN_PRICING_REFERENCE, couponResolution.message, "coupon"));
  }

  const discounts: DiscountInput = { couponTotal, extraAmount, isDealer, dealerRate };

  return {
    services,
    manualLines,
    catalogResolved,
    discounts,
    taxRate: PRODUCTION_TAX_RATE,
    warnings,
    errors,
    couponState,
    discountIntent,
    hasSelection: selected.length > 0 || cfg.storeGlobalOptions.selectedOptionIds.length > 0,
    couponApplications,
    discountBaseSubtotal,
    ppfCoefficientBpByIdentity,
    ppfAdjustmentsByIdentity,
  };
}
