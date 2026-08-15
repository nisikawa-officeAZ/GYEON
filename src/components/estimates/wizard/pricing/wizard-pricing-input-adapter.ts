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
import { toPricingCatalogCoatingId, toPricingCatalogTopcoatId } from "@/lib/pricing/wizard-coating-id-adapter";
import { validateCoatingSelection } from "./coating-selection-validation";
import type { ShopRank } from "../screens/step-types";
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

// BOUNDARY: `shopRank` is OPTIONAL only for the isolated preview/low-level path (e.g. ScreensPreview).
// Every mounted-runtime caller reaches this via computeWizardPricing/useWizardPricing, which thread
// the authoritative rank from EstimateWizardContainer. When omitted, upper layers are NOT priced and
// MULTI_LAYER_NOT_MAPPED is surfaced — never a silent partial multi-layer total.
export function buildWizardPricingInput(draft: EstimateWizardDraftV22, shopRank?: ShopRank): WizardPricingInputBundle {
  const warnings: WizardPricingIssue[] = [];
  const errors: WizardPricingIssue[] = [];
  const services: ServiceInput[] = [];

  const cfg = draft.serviceConfiguration;
  const selected = draft.serviceSelection.selectedCategories;
  const sizeKey = draft.vehicle.bodySizeKey;

  // ── Coating (CATALOG path) — resolved to a production identity via the 10C projection. ──
  // Layer-1 → base coatingId; explicit layer-2/3 → topcoat add-ons, priced ONLY when a shopRank is
  // supplied, the selection is structurally valid, and every add-on has an authoritative price in
  // DEFAULT_PRICING_CATALOG.topcoatBase — otherwise fail closed (no partial coating price). Without a
  // rank, layer-1 is priced and the rest flagged MULTI_LAYER_NOT_MAPPED (legacy behaviour).
  let catalogResolved = false;
  if (selected.includes("coating")) {
    const co = cfg.coating;
    if (co.layer1Id) {
      const coatingId = toPricingCatalogCoatingId(co.layer1Id);
      const layer1Priceable = coatingId !== null && has("coating", coatingId);
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
          (!co.layer2Id || (topcoat2 !== null && DEFAULT_PRICING_CATALOG.topcoatBase[topcoat2] !== undefined)) &&
          (!co.layer3Id || (topcoat3 !== null && DEFAULT_PRICING_CATALOG.topcoatBase[topcoat3] !== undefined));
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
  } else if (dc.mode === "percent") {
    if (dc.percentInput.trim() !== "") {
      const pct = Number(dc.percentInput) || 0;
      discountIntent = { mode: "percentage", percentage: pct };
      errors.push(issue(WIZARD_PRICING_ERRORS.PERCENTAGE_NOT_SUPPORTED, "％値引きは本番価格エンジンで未対応のため、値引きは適用されていません。", "discount"));
    }
  }
  // dc.mode === "none": extraAmount stays 0, discountIntent stays { mode: "none" }, no error.
  // (No implicit else = percent branch — "none" never triggers a percentage-not-supported error.)

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
