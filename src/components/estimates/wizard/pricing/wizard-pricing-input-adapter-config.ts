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
//   • PPF lines carry their dealer coefficient in unitPrice
//   • PPF+coating reduction is calculated from the layer-1 coating price and enters extraAmount
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
  resolveGlobalPpfCoatingAdjustment,
  type PpfCoatingAdjustmentRule,
  type ResolvedPpfCoatingAdjustment,
} from "@/lib/wizard-catalog/ppf-coating-adjustment-core";
import { toPricingCatalogCoatingId, toPricingCatalogTopcoatId } from "@/lib/pricing/wizard-coating-id-adapter";
import {
  COATING_V34_BODY_SIZES,
  type CoatingSettingsV34,
  type CoatingV34BodySize,
  type CoatingV34SizePriceMap,
} from "@/lib/pricing/coating-v34-contract";
import {
  PPF_COEFFICIENT_BP_IDENTITY,
  resolvePpfR1Price,
  type PpfR1PricingScope,
} from "@/lib/pricing/ppf-r1-price-resolution";
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
  WIZARD_PRICING_CONFIG_ERRORS,
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
  /** Authoritative PPF product code/label pairs used by the R1 calculated line. */
  readonly ppfTypes?: readonly import("./wizard-manual-pricing-config").ProductionLabelOption[];
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

/** `sizeKey` is untyped draft input; only an exact seven-size match can index a V3.4 price map. */
function isCoatingV34BodySize(sizeKey: string): sizeKey is CoatingV34BodySize {
  return (COATING_V34_BODY_SIZES as readonly string[]).includes(sizeKey);
}

/** Exact selected-size price from one V3.4 layer map. `null` = unavailable; `0` is a valid price. */
function v34SizePrice(map: CoatingV34SizePriceMap, sizeKey: string): number | null {
  return isCoatingV34BodySize(sizeKey) ? map[sizeKey] : null;
}

function v34BaseSizePrice(v34: CoatingSettingsV34, productId: string, sizeKey: string): number | null {
  const p = v34.baseProducts.find((x) => x.productId === productId);
  return p?.active ? v34SizePrice(p.pricesBySize, sizeKey) : null;
}

function v34Layer2SizePrice(v34: CoatingSettingsV34, productId: string, sizeKey: string): number | null {
  const p = v34.layer2Products.find((x) => x.productId === productId);
  return p?.active ? v34SizePrice(p.layer2PricesBySize, sizeKey) : null;
}

function v34Layer3SizePrice(v34: CoatingSettingsV34, productId: string, sizeKey: string): number | null {
  const p = v34.layer3Products.find((x) => x.productId === productId);
  return p?.active ? v34SizePrice(p.layer3PricesBySize, sizeKey) : null;
}

/** Manual line → canonical "other" line item. Line COMPOSITION only; the engine owns every total. */
function manualLineExtendedPrice(l: WizardManualPricingLineInput): number {
  return Math.round(l.unitPrice * l.quantity);
}

function parseVehicleCoefficientBp(raw: string): number | null {
  const value = raw.trim();
  if (!/^\d+(?:\.\d{1,4})?$/.test(value)) return null;
  const multiplier = Number(value);
  const bp = multiplier * PPF_COEFFICIENT_BP_IDENTITY;
  return Number.isSafeInteger(bp) && bp > 0 ? bp : null;
}

const PPF_R1_PRICING_ERRORS = {
  SETTINGS_REQUIRED: "PPF_R1_SETTINGS_REQUIRED",
  COVERAGE_REQUIRED: "PPF_R1_COVERAGE_REQUIRED",
  TYPE_REQUIRED: "PPF_R1_TYPE_REQUIRED",
  COEFFICIENT_REQUIRED: "PPF_R1_COEFFICIENT_REQUIRED",
  VEHICLE_COEFFICIENT_INVALID: "PPF_R1_VEHICLE_COEFFICIENT_INVALID",
  PRICE_UNAVAILABLE: "PPF_R1_PRICE_UNAVAILABLE",
} as const;

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
    const v34 = catalog.coatingV34;
    if (co.layer1Id) {
      const coatingId = toPricingCatalogCoatingId(co.layer1Id);
      const hasUpper = !!(co.layer2Id || co.layer3Id);

      if (v34) {
        // ── V3.4 authoritative direct-price catalog — independent per-layer, per-size lookup.
        // No topcoatBase, no size multiplier, no cross-layer fallback; a missing size is a hard
        // requirement failure, not a default-coefficient warning (GDA_COATING_V3_4_C2_4). ──
        if (!coatingId) {
          errors.push(issue(WIZARD_PRICING_ERRORS.UNKNOWN_PRICING_REFERENCE, `コーティング「${co.layer1Id}」は本番カタログに対応する識別子がありません。`, "coating", co.layer1Id));
        } else if (!sizeKey) {
          errors.push(issue(WIZARD_PRICING_ERRORS.UNKNOWN_PRICING_REFERENCE, "ボディサイズが未選択のため、コーティング価格を計算できません。", "coating", co.layer1Id));
        } else if (v34BaseSizePrice(v34, coatingId, sizeKey) === null) {
          errors.push(issue(WIZARD_PRICING_ERRORS.UNKNOWN_PRICING_REFERENCE, `コーティング「${co.layer1Id}」の価格が本番カタログに設定されていません。`, "coating", co.layer1Id));
        } else if (shopRank === undefined) {
          // Rank unavailable: cannot validate rank/upper layers. Price layer-1; flag any upper as unmapped.
          if (hasUpper) warnings.push(issue(WIZARD_PRICING_WARNINGS.MULTI_LAYER_NOT_MAPPED, "2層目・3層目は店舗ランク情報がないため計算に含まれていません。", "coating"));
          services.push({ type: "coating", coatingId, sizeKey, optionIds: [] });
          catalogResolved = true;
        } else {
          // Rank available: validate the FULL selection (layer-1 rank gate + upper matrix + certified).
          const valid = validateCoatingSelection(co.layer1Id, co.layer2Id, co.layer3Id, shopRank);
          const topcoat2 = co.layer2Id ? toPricingCatalogTopcoatId(co.layer2Id) : null;
          const topcoat3 = co.layer3Id ? toPricingCatalogTopcoatId(co.layer3Id) : null;
          const upperPriceable =
            (!co.layer2Id || (topcoat2 !== null && v34Layer2SizePrice(v34, topcoat2, sizeKey) !== null)) &&
            (!co.layer3Id || (topcoat3 !== null && v34Layer3SizePrice(v34, topcoat3, sizeKey) !== null));
          if (!valid.ok) {
            errors.push(issue(WIZARD_PRICING_ERRORS.UNKNOWN_PRICING_REFERENCE, valid.reason, "coating", co.layer1Id));
          } else if (!upperPriceable) {
            errors.push(issue(WIZARD_PRICING_ERRORS.UNKNOWN_PRICING_REFERENCE, "コーティング上層に対応する価格が本番カタログにありません。", "coating", co.layer2Id ?? co.layer3Id));
          } else {
            services.push({ type: "coating", coatingId, sizeKey, optionIds: [], ...(topcoat2 ? { topcoat2 } : {}), ...(topcoat3 ? { topcoat3 } : {}) });
            catalogResolved = true;
          }
        }
      } else {
        // ── Legacy/default catalog path — UNCHANGED. Never reached from a V3.4 authoritative
        // catalog, which always carries a non-null catalog.coatingV34. ──
        const layer1Priceable = coatingId !== null && catalog.coatings.some((c) => c.id === coatingId);
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
  }

  // ── Manual categories — AUTHORITATIVE labels only. ─────────────────────────────
  // Full/partial PPF is no longer manual-priced when selected. Remove only that
  // one category from the legacy manual builder, then resolve it below from the
  // versioned R1 catalog. Missing R1 data blocks; it never revives unitPriceInput.
  const ppfUsesR1 = selected.includes("ppf")
    && (cfg.ppf.installationMethod === "full" || cfg.ppf.installationMethod === "partial");
  const manualDraft: EstimateWizardDraftV22 = ppfUsesR1
    ? {
        ...draft,
        serviceSelection: {
          selectedCategories: selected.filter((category) => category !== "ppf"),
        },
      }
    : draft;
  const manual = buildManualPricingLinesFromConfig(manualDraft, config);
  warnings.push(...manual.warnings);
  errors.push(...manual.errors);

  const resolvedPpfR1Lines: WizardManualPricingLineInput[] = [];
  if (ppfUsesR1) {
    const ppf = cfg.ppf;
    const settings = catalog.ppfR1;
    const methodOption = config.ppfMethods.find((entry) => entry.code === ppf.installationMethod);
    const typeId = ppf.ppfTypeId;
    const typeOption = typeId ? config.ppfTypes?.find((entry) => entry.code === typeId) : undefined;
    const installCoefficientBp = typeId
      ? config.installCoefficientBpByCode?.[typeId]
      : undefined;
    const vehicleCoefficientBp = parseVehicleCoefficientBp(ppf.vehicleCoefficientInput);

    let scope: PpfR1PricingScope | null = null;
    if (ppf.installationMethod === "full") {
      if (ppf.fullCoverage) scope = { kind: ppf.fullCoverage, bodySize: sizeKey };
    } else {
      scope = {
        kind: "partial",
        parts: ppf.selectedPartIds.map((partCode) => ({
          partCode,
          quantity: ppf.quantitiesByPart[partCode] ?? 1,
        })),
      };
    }

    if (!methodOption) {
      errors.push(issue(
        WIZARD_PRICING_CONFIG_ERRORS.UNKNOWN_CONFIGURED_ITEM,
        "選択したPPF施工方法は現在の設定に登録されていません。",
        "ppf",
        ppf.installationMethod,
      ));
    } else if (settings === null) {
      errors.push(issue(PPF_R1_PRICING_ERRORS.SETTINGS_REQUIRED, "PPFの正式価格表が未設定です。設定画面で価格を保存してください。", "ppf"));
    } else if (ppf.installationMethod === "full" && scope === null) {
      errors.push(issue(PPF_R1_PRICING_ERRORS.COVERAGE_REQUIRED, "フロントフルまたはフルボディを選択してください。", "ppf", "full"));
    } else if (!typeId || !typeOption) {
      errors.push(issue(PPF_R1_PRICING_ERRORS.TYPE_REQUIRED, "施工するPPF種類を選択してください。", "ppf", typeId));
    } else if (installCoefficientBp === undefined) {
      errors.push(issue(PPF_R1_PRICING_ERRORS.COEFFICIENT_REQUIRED, "選択したPPF種類の施工係数が未設定です。", "ppf", typeId));
    } else if (vehicleCoefficientBp === null) {
      errors.push(issue(PPF_R1_PRICING_ERRORS.VEHICLE_COEFFICIENT_INVALID, "車格係数は0より大きい数値で入力してください。", "ppf", typeId));
    } else if (scope !== null) {
      const resolved = resolvePpfR1Price(settings, scope, installCoefficientBp, vehicleCoefficientBp);
      if (!resolved.ok) {
        errors.push(issue(
          PPF_R1_PRICING_ERRORS.PRICE_UNAVAILABLE,
          "選択内容に対応するPPF価格が未設定です。設定画面の価格を確認してください。",
          "ppf",
          resolved.partCode ?? ppf.installationMethod,
        ));
      } else {
        const scopeLabel = resolved.scope === "front_full"
          ? "フロントフル"
          : resolved.scope === "full_body" ? "フルボディ" : "部分施工";
        const identity = `ppf_r1_${resolved.scope}_${typeId}`;
        resolvedPpfR1Lines.push({
          sourceCategory: "ppf",
          manualPricingIdentity: identity,
          label: `PPF ${scopeLabel}（${typeOption.label}）`,
          quantity: 1,
          unitPrice: resolved.resolvedPriceYen,
          optionIdentity: typeId,
          metadata: {
            ppfR1ContractVersion: settings.contractVersion,
            ppfMethodCode: ppf.installationMethod,
            ppfScope: resolved.scope,
            ppfBodySize: resolved.bodySize,
            ppfBasePriceYen: resolved.basePriceYen,
            ppfInstallCoefficientBp: resolved.installCoefficientBp,
            ppfVehicleCoefficientBp: resolved.vehicleCoefficientBp,
            ppfTypeCode: typeId,
            ...(resolved.scope === "partial"
              ? {
                  ppfPartQuantities: ppf.selectedPartIds
                    .map((partCode) => `${partCode}:${ppf.quantitiesByPart[partCode] ?? 1}`)
                    .join(","),
                }
              : {}),
          },
        });
        catalogResolved = true;
      }
    }
  }

  // ── B1.1: PPF installation coefficient ────────────────────────────────────────
  // The coefficient belongs to the PPF line. PPF+coating reduction is resolved separately below
  // from the layer-1 COATING price; it must never reduce the PPF line itself.
  const coeffByCode = config.installCoefficientBpByCode ?? {};
  const ppfCoefficientBpByIdentity: Record<string, number> = {};
  const ppfAdjustmentsByIdentity: Record<string, ResolvedPpfCoatingAdjustment> = {};

  const manualLines: WizardManualPricingLineInput[] = [...manual.lines, ...resolvedPpfR1Lines].map((l) => {
    if (l.sourceCategory !== "ppf") return l;

    const r1AlreadyApplied = l.metadata.ppfR1ContractVersion === "1.0";
    const bp = r1AlreadyApplied
      ? (typeof l.metadata.ppfInstallCoefficientBp === "number" ? l.metadata.ppfInstallCoefficientBp : undefined)
      : (l.optionIdentity ? coeffByCode[l.optionIdentity] : undefined);
    // R1 already applied both coefficients in the strict resolver. Legacy/manual
    // lines use the selected PPF product identity (not the installation method)
    // to resolve their installation coefficient.
    const coefficientApplied = r1AlreadyApplied
      ? l.unitPrice
      : applyInstallCoefficientBp(l.unitPrice, bp ?? null);
    if (bp !== undefined) ppfCoefficientBpByIdentity[l.manualPricingIdentity] = bp;

    if (coefficientApplied === l.unitPrice) return l;
    return {
      ...l,
      unitPrice: coefficientApplied,
      metadata: {
        ...l.metadata,
        ...(bp !== undefined ? { ppfInstallCoefficientBp: bp } : {}),
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
  const undiscounted = services.length > 0
    ? calculateEstimate(
        services,
        { couponTotal: 0, extraAmount: 0, isDealer: false, dealerRate: 0 },
        PRODUCTION_TAX_RATE,
        catalog,
      )
    : null;
  const discountBaseSubtotal = undiscounted?.subtotal ?? 0;

  // ── PPF + coating reduction ──────────────────────────────────────────────────
  // The approved contract is one dealer-wide rule. Its base is the complete body-coating price
  // (base + layer 2 + layer 3), never the PPF line and never unrelated coating options.
  const adjustmentRules = config.ppfCoatingAdjustments ?? [];
  const coatingLines = undiscounted?.services
    .find((service) => service.type === "coating")
    ?.lineItems ?? [];
  const coatingTotalYen = coatingLines
    .filter((line) => line.catalog_line_role === "base" || line.catalog_line_role === "topcoat2" || line.catalog_line_role === "topcoat3")
    .reduce((total, line) => total + Math.round(line.unit_price * line.quantity), 0);
  const qualifyingPpfLine = manualLines.find((line) => {
    if (line.sourceCategory !== "ppf") return false;
    const scope = line.metadata.ppfScope;
    if (scope === "front_full" || scope === "full_body" || scope === "partial") return true;
    const method = line.metadata.method;
    return method === "full" || method === "partial";
  });
  let ppfCoatingReductionYen = 0;
  let manualLinesWithAdjustment = manualLines;

  if (coatingTotalYen > 0 && qualifyingPpfLine) {
    const adjustment = resolveGlobalPpfCoatingAdjustment(adjustmentRules, coatingTotalYen);
    if (adjustment) {
      ppfCoatingReductionYen = adjustment.reductionYen;
      ppfAdjustmentsByIdentity[qualifyingPpfLine.manualPricingIdentity] = adjustment;
      manualLinesWithAdjustment = manualLines.map((candidate) =>
        candidate.manualPricingIdentity !== qualifyingPpfLine.manualPricingIdentity
          ? candidate
          : {
              ...candidate,
              metadata: {
                ...candidate.metadata,
                ppfCoatingAdjustmentRuleId: adjustment.ruleId,
                ppfCoatingAdjustmentType: adjustment.adjustmentType,
                ppfCoatingAdjustmentValue: adjustment.adjustmentValue,
                ppfCoatingAdjustmentReductionYen: adjustment.reductionYen,
                ppfCoatingAdjustmentCoatingCode: adjustment.coatingCode,
                ppfCoatingAdjustmentBase: "coating_layers_total",
              },
            },
      );
    }
  }

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

  const discounts: DiscountInput = {
    couponTotal,
    extraAmount: extraAmount + ppfCoatingReductionYen,
    isDealer,
    dealerRate,
  };

  return {
    services,
    manualLines: manualLinesWithAdjustment,
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
