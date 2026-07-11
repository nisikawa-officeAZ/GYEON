// Estimate Wizard Ver2.2 — Wizard draft → production pricing input adapter (Phase 10D → 10F-R).
//
// Pure, deterministic. Builds the production engine's `ServiceInput[]` + `DiscountInput` from the
// canonical draft under the HYBRID pricing identity model (Architect resolution 10F-R):
//   • Coating is CATALOG-priced — resolved to a production `pricingReferenceId` via the 10C catalog
//     projection (identity match; never guessed, never label-matched).
//   • PPF / Window / Body Maintenance / Car Wash / Room Cleaning / Other Work / Store Global Options
//     are MANUAL-priced — the operator-entered amounts are prepared by `buildManualPricingLines` and
//     enter canonical aggregation through the EXISTING production manual path (`OtherInput`), so NO
//     production calculator formula changes. The final subtotal/tax/discount/total remain owned by
//     the production engine — this adapter performs NO tax/discount/coupon arithmetic.
// Coupons are excluded (couponTotal 0); percentage discount is forwarded as intent only.

import { DEFAULT_PRICING_CATALOG } from "@/lib/pricing/canonical-pricing-engine";
import type { ServiceInput, DiscountInput, PricingCouponState, PricingDiscountIntent } from "@/lib/pricing/canonical-pricing-engine";
import { projectProductionCatalogToWizard } from "../catalog/project-production-catalog";
import { FIXTURE_PRESENTATION_METADATA } from "../catalog/wizard-catalog-fixtures";
import type { WizardCatalogCategoryId } from "../catalog/wizard-catalog-types";
import type { EstimateWizardDraftV22 } from "../draft/wizard-draft-types";
import type { WizardManualPricingLineInput } from "./wizard-pricing-identity";
import { buildManualPricingLines } from "./wizard-manual-pricing";
import type { WizardPricingIssue } from "./wizard-pricing-types";
import { WIZARD_PRICING_WARNINGS, WIZARD_PRICING_ERRORS } from "./wizard-pricing-types";

// Projected production identity set (built once — deterministic, pure). Coating is the only category
// resolved against the catalog under the hybrid model; other categories are manual-priced.
const PROJECTION = projectProductionCatalogToWizard(DEFAULT_PRICING_CATALOG, FIXTURE_PRESENTATION_METADATA);
const IDS_BY_CATEGORY: Map<WizardCatalogCategoryId, Set<string>> = new Map(
  PROJECTION.categories.map((c) => [c.categoryId, new Set(c.items.map((i) => i.pricingReferenceId).filter((x): x is string => !!x))]),
);
const has = (cat: WizardCatalogCategoryId, id: string | null): boolean =>
  !!id && (IDS_BY_CATEGORY.get(cat)?.has(id) ?? false);

const PRODUCTION_TAX_RATE = 10; // production default (estimate-totals default); Wizard has no tax UI.

export interface WizardPricingInputBundle {
  services:       ServiceInput[];
  manualLines:    WizardManualPricingLineInput[]; // resolved manual lines (identity + operator amount)
  catalogResolved: boolean;                        // a catalog (coating) service was resolved
  discounts:      DiscountInput;
  taxRate:        number;
  warnings:       WizardPricingIssue[];
  errors:         WizardPricingIssue[];
  couponState:    PricingCouponState;
  discountIntent: PricingDiscountIntent;
  hasSelection:   boolean;
}

function issue(code: string, message: string, category: string | null = null, sourceId: string | null = null): WizardPricingIssue {
  return { code, category, sourceId, message };
}

/** Manual line → canonical "other" line item. The single unitPrice×quantity is line COMPOSITION,
 *  not aggregation: the engine still owns subtotal/tax/discount/total. */
function manualLineExtendedPrice(l: WizardManualPricingLineInput): number {
  return Math.round(l.unitPrice * l.quantity);
}

export function buildWizardPricingInput(draft: EstimateWizardDraftV22): WizardPricingInputBundle {
  const warnings: WizardPricingIssue[] = [];
  const errors: WizardPricingIssue[] = [];
  const services: ServiceInput[] = [];

  const cfg = draft.serviceConfiguration;
  const selected = draft.serviceSelection.selectedCategories;
  const sizeKey = draft.vehicle.bodySizeKey;

  // ── Coating (CATALOG path) — resolved to a production identity via the 10C projection. ──
  let catalogResolved = false;
  if (selected.includes("coating")) {
    const co = cfg.coating;
    if (co.layer1Id) {
      if (has("coating", co.layer1Id)) {
        if (!sizeKey) warnings.push(issue(WIZARD_PRICING_WARNINGS.MISSING_BODY_SIZE, "ボディサイズが未選択のため、サイズ係数は既定値で計算されます。", "coating"));
        if (co.layer2Id || co.layer3Id) warnings.push(issue(WIZARD_PRICING_WARNINGS.MULTI_LAYER_NOT_MAPPED, "2層目・3層目は本番トップコート識別子に未対応のため計算に含まれません。", "coating"));
        // Wizard has no catalog coating-option selector; store global options are manual-priced.
        services.push({ type: "coating", coatingId: co.layer1Id, sizeKey, optionIds: [] });
        catalogResolved = true;
      } else {
        errors.push(issue(WIZARD_PRICING_ERRORS.UNKNOWN_PRICING_REFERENCE, `コーティング「${co.layer1Id}」は本番カタログに対応する識別子がありません。`, "coating", co.layer1Id));
      }
    }
  }

  // ── Manual categories (PPF / Window / Maintenance / Car Wash / Room Cleaning / Other / Global) ──
  // Prepared amounts enter canonical aggregation through the existing production manual path.
  const manual = buildManualPricingLines(draft);
  warnings.push(...manual.warnings);
  errors.push(...manual.errors);
  if (manual.lines.length > 0) {
    services.push({ type: "other", items: manual.lines.map((l) => ({ name: l.label, price: manualLineExtendedPrice(l) })) });
  }

  // ── Discount / coupon (forward intent only; NO conversion, NO coupon pricing) ──
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
  } else {
    if (dc.percentInput.trim() !== "") {
      const pct = Number(dc.percentInput) || 0;
      discountIntent = { mode: "percentage", percentage: pct };
      errors.push(issue(WIZARD_PRICING_ERRORS.PERCENTAGE_NOT_SUPPORTED, "％値引きは本番価格エンジンで未対応のため、値引きは適用されていません。", "discount"));
    }
  }

  // Trade (業者掛け率) discount: apply ONLY when a business customer has a VALID rate (0 < rate ≤ 100).
  // An empty/zero/invalid trade rate must NOT become dealerRate=0, because the engine reads
  // dealerRate 0 as "dealer pays 0% → 100% off" (subtotal × (1 − 0/100) = subtotal). That produced the
  // spurious full-subtotal discount (EST-00006: isBusiness=true, no rate → discount 78,000 → total 0).
  // Without a valid rate we apply NO dealer discount (the customer pays full); a valid rate is preserved.
  const rawTradeRate = Number(nc.tradeRate);
  const hasValidTradeRate =
    nc.tradeRate.trim() !== "" &&
    Number.isFinite(rawTradeRate) &&
    rawTradeRate > 0 &&
    rawTradeRate <= 100;
  const isDealer = !!nc.isBusiness && hasValidTradeRate;
  const dealerRate = hasValidTradeRate ? rawTradeRate : 0;

  const couponState: PricingCouponState = dc.selectedCouponIds.length > 0
    ? { status: "selected_not_priced", couponId: dc.selectedCouponIds[0], label: "クーポン", warningCode: "COUPON_PRICING_NOT_IMPLEMENTED" }
    : { status: "none" };
  if (couponState.status !== "none") {
    warnings.push(issue(WIZARD_PRICING_WARNINGS.COUPON_PRICING_NOT_IMPLEMENTED, "クーポンが選択されていますが、本番のクーポン計算は未対応です。合計には含まれません。", "coupon"));
  }

  const discounts: DiscountInput = { couponTotal: 0, extraAmount, isDealer, dealerRate };

  return {
    services,
    manualLines: manual.lines,
    catalogResolved,
    discounts,
    taxRate: PRODUCTION_TAX_RATE,
    warnings,
    errors,
    couponState,
    discountIntent,
    hasSelection: selected.length > 0 || cfg.storeGlobalOptions.selectedOptionIds.length > 0,
  };
}
