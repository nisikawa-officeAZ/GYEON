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
// Coating resolution, the discount/trade-rate rules, the coupon state, the percentage-discount
// refusal, and the tax rate are copied verbatim. No tax, rounding, discount, total, or rank
// coefficient is computed or moved here — every number still originates from the production engine.
// The test suite pins price equivalence against the fixture path for identical inputs.
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
import { toPricingCatalogCoatingId } from "@/lib/pricing/wizard-coating-id-adapter";
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
  config: ProductionPricingConfiguration,
  catalog: PricingCatalog,
): ConfigPricingInputBundle {
  const warnings: WizardPricingIssue[] = [];
  const errors: WizardPricingIssue[] = [];
  const services: ServiceInput[] = [];

  const cfg = draft.serviceConfiguration;
  const selected = draft.serviceSelection.selectedCategories;
  const sizeKey = draft.vehicle.bodySizeKey;

  // ── Coating (CATALOG path) — price and name owned by PricingCatalog, unchanged. ──
  // The Wizard emits a canonical coating id; translate it to the PricingCatalog id through the
  // single adapter before lookup. matte-evo (and any id with no authoritative price) → null → fail
  // closed with UNKNOWN_PRICING_REFERENCE; never a substitute price.
  let catalogResolved = false;
  if (selected.includes("coating")) {
    const co = cfg.coating;
    if (co.layer1Id) {
      const pricingId = toPricingCatalogCoatingId(co.layer1Id);
      const known = pricingId !== null && catalog.coatings.some((c) => c.id === pricingId);
      if (known && pricingId) {
        if (!sizeKey) warnings.push(issue(WIZARD_PRICING_WARNINGS.MISSING_BODY_SIZE, "ボディサイズが未選択のため、サイズ係数は既定値で計算されます。", "coating"));
        if (co.layer2Id || co.layer3Id) warnings.push(issue(WIZARD_PRICING_WARNINGS.MULTI_LAYER_NOT_MAPPED, "2層目・3層目は本番トップコート識別子に未対応のため計算に含まれません。", "coating"));
        services.push({ type: "coating", coatingId: pricingId, sizeKey, optionIds: [] });
        catalogResolved = true;
      } else {
        errors.push(issue(WIZARD_PRICING_ERRORS.UNKNOWN_PRICING_REFERENCE, `コーティング「${co.layer1Id}」は本番カタログに対応する識別子がありません。`, "coating", co.layer1Id));
      }
    }
  }

  // ── Manual categories — AUTHORITATIVE labels only. ─────────────────────────────
  const manual = buildManualPricingLinesFromConfig(draft, config);
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
