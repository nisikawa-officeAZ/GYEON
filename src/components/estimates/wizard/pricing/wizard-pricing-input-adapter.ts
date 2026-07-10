// Estimate Wizard Ver2.2 — Wizard draft → production pricing input adapter (Phase 10D).
//
// Pure, deterministic. Builds the production engine's `ServiceInput[]` + `DiscountInput` from the
// canonical draft, resolving every service to a production `pricingReferenceId` via the catalog
// projection. It performs NO pricing arithmetic (no subtotal/tax/discount math). Unmappable
// selections yield a controlled `UNKNOWN_PRICING_REFERENCE` issue and are excluded — never guessed,
// never priced from fixture data. Coupons are excluded (couponTotal 0); percentage discount is NOT
// converted to yen (returns `PERCENTAGE_NOT_SUPPORTED`). Manual policy: `other_work` = manual_only.

import { DEFAULT_PRICING_CATALOG } from "@/lib/pricing/canonical-pricing-engine";
import type { ServiceInput, DiscountInput, PricingCouponState, PricingDiscountIntent } from "@/lib/pricing/canonical-pricing-engine";
import { projectProductionCatalogToWizard } from "../catalog/project-production-catalog";
import { FIXTURE_PRESENTATION_METADATA } from "../catalog/wizard-catalog-fixtures";
import type { WizardCatalogCategoryId } from "../catalog/wizard-catalog-types";
import type { EstimateWizardDraftV22 } from "../draft/wizard-draft-types";
import type { WizardPricingIssue } from "./wizard-pricing-types";
import { WIZARD_PRICING_WARNINGS, WIZARD_PRICING_ERRORS } from "./wizard-pricing-types";

// Projected production identity set per category (built once — deterministic, pure).
const PROJECTION = projectProductionCatalogToWizard(DEFAULT_PRICING_CATALOG, FIXTURE_PRESENTATION_METADATA);
const IDS_BY_CATEGORY: Map<WizardCatalogCategoryId, Set<string>> = new Map(
  PROJECTION.categories.map((c) => [c.categoryId, new Set(c.items.map((i) => i.pricingReferenceId).filter((x): x is string => !!x))]),
);
const has = (cat: WizardCatalogCategoryId, id: string | null): boolean =>
  !!id && (IDS_BY_CATEGORY.get(cat)?.has(id) ?? false);

const PRODUCTION_TAX_RATE = 10; // production default (estimate-totals default); Wizard has no tax UI.

export interface WizardPricingInputBundle {
  services:       ServiceInput[];
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

export function buildWizardPricingInput(draft: EstimateWizardDraftV22): WizardPricingInputBundle {
  const warnings: WizardPricingIssue[] = [];
  const errors: WizardPricingIssue[] = [];
  const services: ServiceInput[] = [];

  const cfg = draft.serviceConfiguration;
  const selected = draft.serviceSelection.selectedCategories;
  const sizeKey = draft.vehicle.bodySizeKey;

  // Store global options — production models these as coating options; resolve to production option
  // ids (Wizard `gopt-*` ids do not match `iron/polish/…` → controlled UNKNOWN reference).
  const resolvedOptionIds: string[] = [];
  for (const id of cfg.storeGlobalOptions.selectedOptionIds) {
    if (has("store_global_options", id)) resolvedOptionIds.push(id);
    else errors.push(issue(WIZARD_PRICING_ERRORS.UNKNOWN_PRICING_REFERENCE, `追加サービスオプション「${id}」は本番カタログに対応する識別子がありません。`, "store_global_options", id));
  }

  for (const cat of selected) {
    if (cat === "coating") {
      const co = cfg.coating;
      if (!co.layer1Id) continue; // nothing chosen yet
      if (has("coating", co.layer1Id)) {
        if (!sizeKey) warnings.push(issue(WIZARD_PRICING_WARNINGS.MISSING_BODY_SIZE, "ボディサイズが未選択のため、サイズ係数は既定値で計算されます。", "coating"));
        if (co.layer2Id || co.layer3Id) warnings.push(issue(WIZARD_PRICING_WARNINGS.MULTI_LAYER_NOT_MAPPED, "2層目・3層目は本番トップコート識別子に未対応のため計算に含まれません。", "coating"));
        services.push({ type: "coating", coatingId: co.layer1Id, sizeKey, optionIds: resolvedOptionIds });
      } else {
        errors.push(issue(WIZARD_PRICING_ERRORS.UNKNOWN_PRICING_REFERENCE, `コーティング「${co.layer1Id}」は本番カタログに対応する識別子がありません。`, "coating", co.layer1Id));
      }
    } else if (cat === "other") {
      const items: { name: string; price: number }[] = [];
      // Presets carry FIXTURE prices (no production id) — excluded (do not mix fixtures into totals).
      if (cfg.otherWork.selectedPresetIds.length > 0) {
        warnings.push(issue(WIZARD_PRICING_WARNINGS.PREVIEW_ONLY_ITEM, "プリセット項目はプレビュー価格のため計算に含まれません（手入力行のみ計算対象）。", "other"));
      }
      for (const row of cfg.otherWork.customRows) {
        const name = row.name.trim();
        if (!name) continue;
        const price = Number(row.unitPrice);
        if (row.unitPrice.trim() === "" || !Number.isFinite(price)) {
          errors.push(issue(WIZARD_PRICING_ERRORS.MANUAL_PRICE_REQUIRED, `「${name}」の金額が未入力です。`, "other", row.id));
          continue;
        }
        items.push({ name, price });
      }
      if (items.length > 0) services.push({ type: "other", items });
    } else {
      // ppf / window / maintenance / carwash / roomclean — Wizard ids do not map to production ids.
      errors.push(issue(WIZARD_PRICING_ERRORS.UNKNOWN_PRICING_REFERENCE, `「${cat}」の選択項目は本番カタログ識別子への対応が未確立のため計算に含まれません。`, cat));
    }
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
    // percentage — production pricing has no percentage operator-discount path.
    if (dc.percentInput.trim() !== "") {
      const pct = Number(dc.percentInput) || 0;
      discountIntent = { mode: "percentage", percentage: pct };
      errors.push(issue(WIZARD_PRICING_ERRORS.PERCENTAGE_NOT_SUPPORTED, "％値引きは本番価格エンジンで未対応のため、値引きは適用されていません。", "discount"));
    }
  }

  const isDealer = !!nc.isBusiness;
  const dealerRate = Number(nc.tradeRate) || 0;

  const couponState: PricingCouponState = dc.selectedCouponIds.length > 0
    ? { status: "selected_not_priced", couponId: dc.selectedCouponIds[0], label: "クーポン", warningCode: "COUPON_PRICING_NOT_IMPLEMENTED" }
    : { status: "none" };
  if (couponState.status !== "none") {
    warnings.push(issue(WIZARD_PRICING_WARNINGS.COUPON_PRICING_NOT_IMPLEMENTED, "クーポンが選択されていますが、本番のクーポン計算は未対応です。合計には含まれません。", "coupon"));
  }

  const discounts: DiscountInput = { couponTotal: 0, extraAmount, isDealer, dealerRate };

  return { services, discounts, taxRate: PRODUCTION_TAX_RATE, warnings, errors, couponState, discountIntent, hasSelection: selected.length > 0 };
}
