// GDA-ESTIMATE-PR123-R2 — final-review line adjustments: parity with the canonical route,
// discount/coupon separation, multi-PPF reductions, and fail-closed validation.
import assert from "node:assert/strict";
import test from "node:test";

import { resetWizardDraft } from "../draft/wizard-draft-state";
import type { EstimateWizardDraftV22 } from "../draft/wizard-draft-types";
import { makePricingCatalog } from "@/lib/pricing/pricing-catalog";
import { percentOfYen } from "@/lib/pricing/configured-coupon-total";
import {
  GLOBAL_PPF_COATING_ADJUSTMENT_COATING_CODE as CC,
  GLOBAL_PPF_COATING_ADJUSTMENT_METHOD_CODE as MC,
} from "@/lib/wizard-catalog/ppf-coating-adjustment-core";
import { mapWizardDraftToSaveRequestFromConfig } from "../save/estimate-save-mapper-from-config";
import type { EstimateSaveRequest } from "../save/estimate-save-dto";
import { computeWizardPricingFromConfig } from "./compute-wizard-pricing-from-config";
import { wizardPricingLineId } from "./wizard-line-order";
import {
  buildWizardPricingInputFromConfig,
  type ConfigPricingInputBundle,
  type ConfiguredPricingConfiguration,
} from "./wizard-pricing-input-adapter-config";
import {
  applyWizardReviewLineAdjustments,
  resolvedCouponApplicationsForSubtotal,
  resolvedPpfCoatingReductionForLines,
  reviewQuantityPolicyForLine,
} from "./wizard-review-line-adjustments";
import type { WizardPricingResult } from "./wizard-pricing-types";

const CATALOG = makePricingCatalog();
const PC: ConfiguredPricingConfiguration = {
  ppfMethods: [], filmTypes: [], washMenus: [], roomCleaningMenus: [],
  storeGlobalOptions: [
    // quantityRequired + configured bounds 1..5 — the ONLY kind of line whose quantity may change.
    { code: "go-q",   label: "数量オプション", priceable: true, quantityRequired: true,  minQuantity: 1, maxQuantity: 5 },
    // quantityRequired with a minimum ABOVE 1 and a bounded maximum.
    { code: "go-min", label: "最小数量オプション", priceable: true, quantityRequired: true, minQuantity: 2, maxQuantity: 4 },
    // priceable but NOT quantityRequired — a single-unit line whose quantity is fixed.
    { code: "go-1",   label: "単品オプション", priceable: true, quantityRequired: false, minQuantity: 1, maxQuantity: null },
  ],
  maintenanceMenus: [{ code: "mm1", label: "6ヶ月ボディメンテナンス" }],
  coupons: [{
    couponId: "00000000-0000-4000-8000-000000000100", code: "pct-10", label: "10%クーポン",
    value: { kind: "percent", basisPoints: 1_000 }, combinable: true,
    validFrom: null, validTo: null, isActive: true, displayOrder: 1,
  }],
};

function draft(over?: (d: EstimateWizardDraftV22) => void): EstimateWizardDraftV22 {
  const d = resetWizardDraft();
  d.vehicle.bodySizeKey = "M";
  d.serviceSelection.selectedCategories = ["coating", "maintenance"];
  d.serviceConfiguration.coating.layer1Id = "pure-evo";
  d.serviceConfiguration.bodyMaintenance.menuId = "mm1";
  d.serviceConfiguration.bodyMaintenance.unitPriceInput = "5000";
  d.discountAndCoupon = { mode: "amount", percentInput: "", amountInput: "1000", selectedCouponIds: [PC.coupons![0]!.couponId], adjustmentReason: "" };
  over?.(d);
  return d;
}

/** Select a store-global option with a draft unit price and (for quantityRequired options) a draft quantity. */
function selectOption(d: EstimateWizardDraftV22, code: string, unitPrice: string, quantity?: number): void {
  d.serviceConfiguration.storeGlobalOptions.selectedOptionIds.push(code);
  d.serviceConfiguration.storeGlobalOptions.unitPricesByOption[code] = unitPrice;
  if (quantity !== undefined) d.serviceConfiguration.storeGlobalOptions.quantitiesByOption[code] = quantity;
}

const totalsOf = (r: WizardPricingResult) => ({
  subtotal: r.subtotal, discountTotal: r.discountTotal, couponTotal: r.couponTotal,
  taxableSubtotal: r.taxableSubtotal, taxTotal: r.taxTotal, grandTotal: r.grandTotal,
  completeness: r.completeness, status: r.status,
});

/** The persisted request for a draft + result, through the production save mapper (must succeed). */
function persisted(d: EstimateWizardDraftV22, pr: WizardPricingResult): EstimateSaveRequest {
  const mapped = mapWizardDraftToSaveRequestFromConfig({ draft: d, pricingResult: pr, pricingConfig: PC, catalog: CATALOG, shopRank: "detailer" });
  assert.equal(mapped.ok, true, "save mapper accepts the result");
  if (!mapped.ok) throw new Error("unreachable");
  return mapped.request;
}

/**
 * The canonical monetary contract (pinned at HEAD by useWizardPricingFromConfig.test "10b" and the
 * config save-mapper coupon test): `couponTotal` is ONLY the coupon; `discountTotal` is the engine-
 * APPLIED combined document discount (authored + coupon, the coupon counted exactly once); the total
 * subtracts `discountTotal` exactly once and never `couponTotal` a second time.
 */
function assertCouponCountedOnce(r: WizardPricingResult, authored: number, coupon: number) {
  const subtotal = r.subtotal as number;
  assert.equal(r.couponTotal, coupon, "couponTotal is ONLY the coupon");
  assert.equal(r.discountTotal, authored + coupon, "applied document discount = authored + coupon (once)");
  assert.equal((r.discountTotal as number) - (r.couponTotal as number), authored, "non-coupon part is ONLY the authored discount");
  assert.equal(r.taxableSubtotal, subtotal, "post-tax rule: tax base IS the subtotal");
  assert.equal(r.taxTotal, Math.floor(subtotal / 10), "tax on the full subtotal");
  assert.equal(r.grandTotal, subtotal + Math.floor(subtotal / 10) - (r.discountTotal as number), "total = subtotal + tax − applied discount");
  assert.equal(r.grandTotal, subtotal + Math.floor(subtotal / 10) - authored - coupon, "coupon subtracted exactly once");
}

/** The persisted snapshot never double-counts the coupon and never conflates it with the authored figure. */
function assertPersistedCouponCountedOnce(req: EstimateSaveRequest, authored: number) {
  const p = req.pricing;
  assert.equal(p.grandTotal, (p.subtotal as number) + (p.taxTotal as number) - (p.discountTotal as number), "persisted total subtracts discountTotal once; couponTotal is never subtracted again");
  assert.equal(req.discount.appliedAmount, p.discountTotal, "discount.appliedAmount is the applied document discount, copied");
  assert.equal(req.coupon.appliedAmount, p.couponTotal, "coupon.appliedAmount is the coupon, copied");
  assert.equal((req.discount.appliedAmount as number) - (req.coupon.appliedAmount as number), authored, "applied − coupon = authored (nothing else folded in)");
  assert.equal(req.discount.intent.fixedAmount, authored, "the authored figure is persisted as intent, never conflated with the applied amount");
  assert.equal(req.coupon.status, "applied");
  assert.equal((req.coupon.applications ?? []).reduce((sum, a) => sum + a.appliedAmount, 0), p.couponTotal, "per-coupon snapshot sums to couponTotal exactly");
}

test("parity: identity edits reproduce the canonical unadjusted subtotal, tax, discount, coupon and total", () => {
  const canonicalDraft = draft();
  const canonical = computeWizardPricingFromConfig(canonicalDraft, PC, CATALOG, "detailer");
  assert.equal(canonical.completeness, "complete");
  const lineSum = canonical.lines.reduce((sum, l) => sum + (l.lineTotal ?? 0), 0);
  assert.equal(canonical.subtotal, lineSum, "subtotal is the sum of the priced lines");
  assertCouponCountedOnce(canonical, 1_000, percentOfYen(lineSum, 1_000));

  const identityDraft = draft((d) => {
    for (const line of canonical.lines) {
      const id = wizardPricingLineId(line);
      d.review.quantityInputsByLine[id] = String(line.quantity);
      d.review.unitPriceInputsByLine[id] = String(line.unitPrice);
    }
  });
  const identity = computeWizardPricingFromConfig(identityDraft, PC, CATALOG, "detailer");
  assert.deepEqual(totalsOf(identity), totalsOf(canonical));
  assert.deepEqual(identity.lines, canonical.lines);

  // The identity-edited request persists with EXACTLY the canonical semantic fields, and the
  // snapshot counts the coupon exactly once.
  const canonicalReq = persisted(canonicalDraft, canonical);
  const identityReq = persisted(identityDraft, identity);
  assert.deepEqual(identityReq.pricing, canonicalReq.pricing);
  assert.deepEqual(identityReq.discount, canonicalReq.discount);
  assert.deepEqual(identityReq.coupon, canonicalReq.coupon);
  assert.deepEqual(identityReq.services, canonicalReq.services);
  assertPersistedCouponCountedOnce(canonicalReq, 1_000);
  assertPersistedCouponCountedOnce(identityReq, 1_000);
});

test("edits keep coupon ONLY in couponTotal, count it once in the applied discount, and recompute through the canonical engine", () => {
  const withOption = (d: EstimateWizardDraftV22) => selectOption(d, "go-q", "3000", 2);
  const canonical = computeWizardPricingFromConfig(draft(withOption), PC, CATALOG, "detailer");
  assert.equal(canonical.completeness, "complete");
  const coating = canonical.lines.find((l) => l.kind === "catalog")!;
  const editedDraft = draft((d) => {
    withOption(d);
    // quantity change ONLY on the quantityRequired option (2 → 3, within 1..5); unit-price change on mm1.
    d.review.quantityInputsByLine["manual:store_global_options:go-q"] = "3";
    d.review.unitPriceInputsByLine["manual:maintenance:mm1"] = "7000";
  });
  const edited = computeWizardPricingFromConfig(editedDraft, PC, CATALOG, "detailer");
  assert.equal(edited.completeness, "complete");
  const coatingTotal = coating.lineTotal as number;
  const option = edited.lines.find((l) => l.sourceId === "store_global_options:go-q")!;
  assert.equal(option.quantity, 3);
  assert.equal(option.lineTotal, 9_000);
  const subtotal = coatingTotal + 7_000 + 9_000;
  assert.equal(edited.subtotal, subtotal);
  assert.notEqual(subtotal, canonical.subtotal, "the edit really changed the subtotal");
  const coupon = percentOfYen(subtotal, 1_000);
  assert.notEqual(coupon, canonical.couponTotal, "percent coupon re-resolved against the ADJUSTED subtotal");
  // Fixed discount unchanged (1,000); coupon re-resolved; applied discount = 1,000 + coupon, once.
  assertCouponCountedOnce(edited, 1_000, coupon);
  assertPersistedCouponCountedOnce(persisted(editedDraft, edited), 1_000);
});

test("invalid edits fail closed with null totals and INVALID_REVIEW_ADJUSTMENT; stale ids are ignored", () => {
  for (const [q, p] of [["0", "60000"], ["1.5", "60000"], ["1", "-1"], ["1", "1e3"], ["", "60000"]] as const) {
    const r = computeWizardPricingFromConfig(draft((d) => {
      d.review.quantityInputsByLine["catalog:coating:base:pure-evo"] = q;
      d.review.unitPriceInputsByLine["catalog:coating:base:pure-evo"] = p;
    }), PC, CATALOG, "detailer");
    assert.equal(r.status, "error", `${q}/${p}`);
    assert.equal(r.completeness, "error", `${q}/${p}`);
    assert.equal(r.grandTotal, null, `${q}/${p}`);
    assert.ok(r.errors.some((e) => e.code === "INVALID_REVIEW_ADJUSTMENT"), `${q}/${p}`);
  }
  const canonical = computeWizardPricingFromConfig(draft(), PC, CATALOG, "detailer");
  const stale = computeWizardPricingFromConfig(draft((d) => {
    d.review.quantityInputsByLine["catalog:coating:base:not-a-line"] = "9";
  }), PC, CATALOG, "detailer");
  assert.deepEqual(totalsOf(stale), totalsOf(canonical));
});

test("coupon snapshot re-resolution mirrors resolveConfiguredCoupons (amount fixed, percent of subtotal)", () => {
  const apps = resolvedCouponApplicationsForSubtotal([
    { couponId: "a", code: "a", label: "A", valueKind: "amount", valueRaw: 100, appliedAmount: 100 },
    { couponId: "p", code: "p", label: "P", valueKind: "percent", valueRaw: 1_000, appliedAmount: 6_500 },
  ], 127_000);
  assert.deepEqual(apps.map((a) => a.appliedAmount), [100, 12_700]);
});

test("multi-PPF reductions: every resolved adjustment contributes, clamped to the coating base", () => {
  const lines: WizardPricingResult["lines"] = [
    { kind: "catalog", category: "coating", sourceId: "coating:PURE EVO", label: "PURE EVO", quantity: 1,
      unitPrice: 60_000, lineSubtotal: 60_000, lineTotal: 60_000, discountAmount: null, taxAmount: null,
      pricingReferenceId: "pure-evo", catalogLineRole: "base" },
    { kind: "manual", category: "ppf", sourceId: "ppf:x", label: "PPF", quantity: 1, unitPrice: 100_000,
      lineSubtotal: 100_000, lineTotal: 100_000, discountAmount: null, taxAmount: null, pricingReferenceId: null, catalogLineRole: null },
  ];
  const two = {
    ppfAdjustmentsByIdentity: {
      "ppf_r1_front_full_a": { ruleId: "r", ppfMethodCode: MC, coatingCode: CC, adjustmentType: "amount" as const, adjustmentValue: 5_000, reductionYen: 5_000 },
      "ppf_r1_front_full_b": { ruleId: "r", ppfMethodCode: MC, coatingCode: CC, adjustmentType: "percent" as const, adjustmentValue: 1_000, reductionYen: 6_000 },
    },
  } as unknown as Pick<ConfigPricingInputBundle, "ppfAdjustmentsByIdentity">;
  assert.equal(resolvedPpfCoatingReductionForLines(lines, two), 11_000, "5,000 + 10% of 60,000 — not only the first");
  const huge = {
    ppfAdjustmentsByIdentity: {
      a: { ruleId: "r", ppfMethodCode: MC, coatingCode: CC, adjustmentType: "amount" as const, adjustmentValue: 50_000, reductionYen: 50_000 },
      b: { ruleId: "r", ppfMethodCode: MC, coatingCode: CC, adjustmentType: "amount" as const, adjustmentValue: 50_000, reductionYen: 50_000 },
    },
  } as unknown as Pick<ConfigPricingInputBundle, "ppfAdjustmentsByIdentity">;
  assert.equal(resolvedPpfCoatingReductionForLines(lines, huge), 60_000, "never exceeds the coating base");
  assert.equal(resolvedPpfCoatingReductionForLines(lines.slice(1), two), 0, "no coating → no reduction");
});

test("a line the authoritative route left unpriced is never priced by a review edit", () => {
  const base: WizardPricingResult = {
    status: "success", completeness: "partial", currency: "JPY",
    lines: [{ kind: "manual", category: "ppf", sourceId: "ppf:x", label: "PPF", quantity: 1, unitPrice: null,
      lineSubtotal: null, lineTotal: null, discountAmount: null, taxAmount: null, pricingReferenceId: null, catalogLineRole: null }],
    unresolvedItems: [], subtotal: 0, discountTotal: 0, couponTotal: 0, taxableSubtotal: 0, taxTotal: 0, grandTotal: 0,
    warnings: [], errors: [], couponState: { status: "none" }, discountIntent: { mode: "none" },
  };
  const bundle = {
    discounts: { couponTotal: 0, extraAmount: 0, isDealer: false, dealerRate: 0 }, taxRate: 10,
    couponApplications: [], ppfAdjustmentsByIdentity: {}, discountIntent: { mode: "none" },
  } as unknown as ConfigPricingInputBundle;
  const r = applyWizardReviewLineAdjustments(base, bundle, {
    quantityInputsByLine: {}, unitPriceInputsByLine: { "manual:ppf:x": "125000" },
  }, CATALOG, PC);
  assert.equal(r.status, "error");
  assert.equal(r.grandTotal, null);
  assert.equal(r.lines[0]?.unitPrice, null, "no price manufactured");
});

// ── GDA-ESTIMATE-PR133 P2-1 — quantity edits obey the canonical manual option policy ─────────────

const expectRejected = (r: WizardPricingResult, label: string) => {
  assert.equal(r.status, "error", label);
  assert.equal(r.completeness, "error", label);
  assert.equal(r.subtotal, null, label);
  assert.equal(r.grandTotal, null, label);
  assert.ok(r.errors.some((e) => e.code === "INVALID_REVIEW_ADJUSTMENT"), label);
};

test("P2-1: a quantity change on a line WITHOUT quantityRequired is rejected (manual, catalog, non-quantity option)", () => {
  const withOption = (d: EstimateWizardDraftV22) => selectOption(d, "go-1", "2500");
  const canonical = computeWizardPricingFromConfig(draft(withOption), PC, CATALOG, "detailer");
  assert.equal(canonical.completeness, "complete", "PRECONDITION: the canonical draft prices cleanly");
  assert.equal(canonical.lines.find((l) => l.sourceId === "store_global_options:go-1")?.quantity, 1);

  for (const id of ["manual:maintenance:mm1", "catalog:coating:base:pure-evo", "manual:store_global_options:go-1"]) {
    const r = computeWizardPricingFromConfig(draft((d) => {
      withOption(d);
      d.review.quantityInputsByLine[id] = "2";
    }), PC, CATALOG, "detailer");
    expectRejected(r, id);
    assert.ok(r.errors.some((e) => e.message.includes("数量は変更できません")), `${id}: operator-safe policy message`);
    assert.deepEqual(r.lines, canonical.lines, `${id}: no line is re-priced by a rejected edit`);
  }
});

test("P2-1: a quantityRequired line rejects a quantity below minQuantity or above maxQuantity", () => {
  const withOptions = (d: EstimateWizardDraftV22) => { selectOption(d, "go-q", "3000", 2); selectOption(d, "go-min", "1000", 3); };
  const canonical = computeWizardPricingFromConfig(draft(withOptions), PC, CATALOG, "detailer");
  assert.equal(canonical.completeness, "complete", "PRECONDITION");

  const cases: ReadonlyArray<readonly [string, string]> = [
    ["manual:store_global_options:go-q",   "6"], // max 5
    ["manual:store_global_options:go-min", "1"], // min 2
    ["manual:store_global_options:go-min", "5"], // max 4
  ];
  for (const [id, q] of cases) {
    const r = computeWizardPricingFromConfig(draft((d) => {
      withOptions(d);
      d.review.quantityInputsByLine[id] = q;
    }), PC, CATALOG, "detailer");
    expectRejected(r, `${id}=${q}`);
    assert.ok(r.errors.some((e) => e.message.includes("範囲で入力")), `${id}=${q}: bounds message`);
  }
});

test("P2-1: a configured, in-bounds quantity on a quantityRequired line succeeds and recomputes; identity quantities stay accepted everywhere", () => {
  const withOptions = (d: EstimateWizardDraftV22) => { selectOption(d, "go-q", "3000", 2); selectOption(d, "go-min", "1000", 3); };
  const canonical = computeWizardPricingFromConfig(draft(withOptions), PC, CATALOG, "detailer");
  const coatingTotal = canonical.lines.find((l) => l.kind === "catalog")!.lineTotal as number;

  const editedDraft = draft((d) => {
    withOptions(d);
    d.review.quantityInputsByLine["manual:store_global_options:go-q"] = "5";   // max bound, inclusive
    d.review.quantityInputsByLine["manual:store_global_options:go-min"] = "2"; // min bound, inclusive
    d.review.quantityInputsByLine["manual:maintenance:mm1"] = "1";             // identity on a fixed line
    d.review.quantityInputsByLine["catalog:coating:base:pure-evo"] = "1";      // identity on a catalog line
  });
  const edited = computeWizardPricingFromConfig(editedDraft, PC, CATALOG, "detailer");
  assert.equal(edited.completeness, "complete");
  assert.equal(edited.lines.find((l) => l.sourceId === "store_global_options:go-q")?.quantity, 5);
  assert.equal(edited.lines.find((l) => l.sourceId === "store_global_options:go-q")?.lineTotal, 15_000);
  assert.equal(edited.lines.find((l) => l.sourceId === "store_global_options:go-min")?.quantity, 2);
  assert.equal(edited.lines.find((l) => l.sourceId === "store_global_options:go-min")?.lineTotal, 2_000);
  const subtotal = coatingTotal + 5_000 + 15_000 + 2_000;
  assert.equal(edited.subtotal, subtotal);
  assertCouponCountedOnce(edited, 1_000, percentOfYen(subtotal, 1_000));
  assertPersistedCouponCountedOnce(persisted(editedDraft, edited), 1_000);
});

test("P2-1: reviewQuantityPolicyForLine resolves ONLY through the bundle manual source line + configured option", () => {
  const withOptions = (d: EstimateWizardDraftV22) => { selectOption(d, "go-q", "3000", 2); selectOption(d, "go-1", "2500"); };
  const d = draft(withOptions);
  const bundle = buildWizardPricingInputFromConfig(d, PC, CATALOG, "detailer");
  const result = computeWizardPricingFromConfig(d, PC, CATALOG, "detailer");
  const line = (sourceId: string) => result.lines.find((l) => l.sourceId === sourceId)!;

  assert.deepEqual(reviewQuantityPolicyForLine(line("store_global_options:go-q"), bundle, PC), { minQuantity: 1, maxQuantity: 5 });
  assert.equal(reviewQuantityPolicyForLine(line("store_global_options:go-1"), bundle, PC), null, "not quantityRequired");
  assert.equal(reviewQuantityPolicyForLine(line("maintenance:mm1"), bundle, PC), null, "no quantity rule for maintenance");
  assert.equal(reviewQuantityPolicyForLine(result.lines.find((l) => l.kind === "catalog")!, bundle, PC), null, "catalog lines are fixed");
  // A result line that no bundle source line backs can never earn a policy (no inference from label/category).
  assert.equal(reviewQuantityPolicyForLine(line("store_global_options:go-q"), { manualLines: [] }, PC), null);
  // The configured option is the bounds authority: without it, even a quantityRequired source is fixed.
  assert.equal(reviewQuantityPolicyForLine(line("store_global_options:go-q"), bundle, { ...PC, storeGlobalOptions: [] }), null);
});

test("P2-1: no adjustment ⇒ the authoritative result is returned as-is (same reference), byte-identical to canonical", () => {
  const d = draft((sd) => selectOption(sd, "go-q", "3000", 2));
  const bundle = buildWizardPricingInputFromConfig(d, PC, CATALOG, "detailer");
  const canonical = computeWizardPricingFromConfig(d, PC, CATALOG, "detailer");
  const same = applyWizardReviewLineAdjustments(canonical, bundle, { quantityInputsByLine: {}, unitPriceInputsByLine: {} }, CATALOG, PC);
  assert.equal(same, canonical, "no adjustment returns the input object itself");
  const recomputed = computeWizardPricingFromConfig({ ...d, review: { ...d.review, quantityInputsByLine: {}, unitPriceInputsByLine: {} } }, PC, CATALOG, "detailer");
  assert.deepEqual(recomputed, canonical);
});
