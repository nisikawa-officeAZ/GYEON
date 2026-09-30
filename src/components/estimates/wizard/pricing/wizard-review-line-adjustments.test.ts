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
  annotateWizardReviewQuantityPolicies,
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

// ── GDA-ESTIMATE-QUANTITY-POLICY-R1 (Stage A) — the presentation policy IS the adjustment policy ──

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    for (const v of Object.values(value as object)) deepFreeze(v);
    Object.freeze(value);
  }
  return value;
}

test("annotateWizardReviewQuantityPolicies is pure: fresh result/lines, input untouched, policy = reviewQuantityPolicyForLine, nothing else changes", () => {
  const d = draft((sd) => { selectOption(sd, "go-q", "3000", 2); selectOption(sd, "go-min", "1000", 3); selectOption(sd, "go-1", "2500"); });
  const bundle = buildWizardPricingInputFromConfig(d, PC, CATALOG, "detailer");
  const computed = computeWizardPricingFromConfig(d, PC, CATALOG, "detailer");
  assert.equal(computed.completeness, "complete", "PRECONDITION");
  // Start from an UN-annotated copy so the test proves the annotation itself.
  const unannotated: WizardPricingResult = deepFreeze({
    ...computed,
    lines: computed.lines.map((line) => { const { quantityPolicy: _p, ...rest } = line; void _p; return rest as WizardPricingResult["lines"][number]; }),
  });
  const before = JSON.stringify(unannotated);

  const annotated = annotateWizardReviewQuantityPolicies(unannotated, bundle, PC);
  assert.notEqual(annotated, unannotated, "fresh result object");
  assert.equal(JSON.stringify(unannotated), before, "input never mutated (and frozen input did not throw)");
  assert.equal(annotated.lines.length, unannotated.lines.length);
  for (const [i, line] of annotated.lines.entries()) {
    const source = unannotated.lines[i]!;
    assert.notEqual(line, source, `${line.sourceId}: fresh line object`);
    assert.deepEqual(line.quantityPolicy, reviewQuantityPolicyForLine(source, bundle, PC), `${line.sourceId}: same policy as the adjustment rule`);
    const { quantityPolicy: _p, ...rest } = line; void _p;
    assert.deepEqual(rest, source, `${line.sourceId}: no other field touched`);
  }
  assert.deepEqual(totalsOf(annotated), totalsOf(unannotated), "totals untouched");
  assert.deepEqual(annotated.lines, computed.lines, "identical to what the compute route hands the UI");

  const matrix = Object.fromEntries(annotated.lines.map((l) => [l.sourceId, l.quantityPolicy]));
  assert.equal(matrix["store_global_options:go-1"], null, "non-quantity option fixed");
  assert.equal(matrix["maintenance:mm1"], null, "maintenance fixed");
  assert.deepEqual(matrix["store_global_options:go-q"], { minQuantity: 1, maxQuantity: 5 });
  assert.deepEqual(matrix["store_global_options:go-min"], { minQuantity: 2, maxQuantity: 4 });
  assert.equal(annotated.lines.find((l) => l.kind === "catalog")?.quantityPolicy, null, "catalog coating fixed");

  // Empty / error results pass through with no lines invented.
  const none = annotateWizardReviewQuantityPolicies({ ...computed, lines: [] }, bundle, PC);
  assert.deepEqual(none.lines, []);
});

test("the annotation never widens or narrows what applyWizardReviewLineAdjustments accepts (authority stays in the rule, fail closed)", () => {
  const d = draft((sd) => { selectOption(sd, "go-q", "3000", 2); });
  const bundle = buildWizardPricingInputFromConfig(d, PC, CATALOG, "detailer");
  const canonical = computeWizardPricingFromConfig(d, PC, CATALOG, "detailer");
  assert.equal(canonical.completeness, "complete", "PRECONDITION");

  // A FIXED catalog line tampered to claim editable bounds is STILL rejected on a quantity change.
  const widened: WizardPricingResult = {
    ...canonical,
    lines: canonical.lines.map((l) => (l.kind === "catalog" ? { ...l, quantityPolicy: { minQuantity: 1, maxQuantity: 99 } } : l)),
  };
  expectRejected(applyWizardReviewLineAdjustments(widened, bundle, {
    quantityInputsByLine: { "catalog:coating:base:pure-evo": "2" }, unitPriceInputsByLine: {},
  }, CATALOG, PC), "tampered catalog annotation");

  // An EDITABLE option line tampered to claim it is fixed STILL accepts an in-bounds change.
  const narrowed: WizardPricingResult = {
    ...canonical,
    lines: canonical.lines.map((l) => (l.sourceId === "store_global_options:go-q" ? { ...l, quantityPolicy: null } : l)),
  };
  const accepted = applyWizardReviewLineAdjustments(narrowed, bundle, {
    quantityInputsByLine: { "manual:store_global_options:go-q": "4" }, unitPriceInputsByLine: {},
  }, CATALOG, PC);
  assert.equal(accepted.status, canonical.status);
  assert.equal(accepted.completeness, "complete");
  assert.equal(accepted.lines.find((l) => l.sourceId === "store_global_options:go-q")?.quantity, 4);
  assert.equal(accepted.lines.find((l) => l.sourceId === "store_global_options:go-q")?.lineTotal, 12_000);

  // And through the compute route, the annotation is always re-derived from bundle + config.
  const viaCompute = computeWizardPricingFromConfig(draft((sd) => {
    selectOption(sd, "go-q", "3000", 2);
    sd.review.quantityInputsByLine["manual:store_global_options:go-q"] = "4";
  }), PC, CATALOG, "detailer");
  assert.deepEqual(viaCompute.lines.find((l) => l.sourceId === "store_global_options:go-q")?.quantityPolicy, { minQuantity: 1, maxQuantity: 5 });
  assert.equal(viaCompute.lines.find((l) => l.sourceId === "store_global_options:go-q")?.quantity, 4);
});

// ── GDA-ESTIMATE-QUANTITY-POLICY-R1 (Stage B) — partial PPF PART lines at final review ──────────────

const PPF_PC: ConfiguredPricingConfiguration = {
  ...PC,
  ppfMethods: [{ code: "full", label: "外装フル施工" }, { code: "partial", label: "部分施工" }],
  ppfTypes: [{ code: "t1", label: "T1" }],
  ppfParts: [{ code: "bonnet", label: "ボンネット", minQuantity: 1, maxQuantity: 4 }, { code: "fender", label: "フェンダー", minQuantity: 1, maxQuantity: null }],
  installCoefficientBpByCode: { t1: 12_500 },
  ppfCoatingAdjustments: [{ ruleId: "r", ppfMethodCode: MC, coatingCode: CC, adjustmentType: "amount", adjustmentValue: 5_000, isActive: true }],
};
const PPF_CATALOG = makePricingCatalog({ ppfR1: {
  contractVersion: "1.0",
  frontFullPricesBySize: { SS: 1, S: 1, M: 100_000, ML: 1, L: 1, LL: 1, XL: 1 },
  fullBodyPricesBySize: { SS: 1, S: 1, M: 300_000, ML: 1, L: 1, LL: 1, XL: 1 },
  partialPartPrices: { bonnet: 40_000, fender: 20_000 },
} });
const BONNET = "manual:ppf:ppf_r1_partial_t1_bonnet";
const ppfDraft = (over?: (d: EstimateWizardDraftV22) => void) => draft((d) => {
  d.serviceSelection.selectedCategories = ["coating", "ppf"];
  d.discountAndCoupon = { mode: "none", percentInput: "", amountInput: "", selectedCouponIds: [], adjustmentReason: "" };
  d.serviceConfiguration.ppf = { ...d.serviceConfiguration.ppf, installationMethod: "partial", fullCoverage: null, ppfTypeId: "t1", selectedPartIds: ["bonnet", "fender"], quantitiesByPart: { bonnet: 2 }, vehicleCoefficientInput: "1.0" };
  over?.(d);
});

test("Stage B: a valid in-bounds review quantity on a partial part line is accepted (unit × quantity), reduction stays once; the persisted request matches", () => {
  const canonical = computeWizardPricingFromConfig(ppfDraft(), PPF_PC, PPF_CATALOG, "detailer");
  assert.equal(canonical.completeness, "complete", "PRECONDITION");
  assert.equal(canonical.lines.find((l) => wizardPricingLineId(l) === BONNET)?.lineTotal, 100_000, "2 × 50,000");
  assert.equal(canonical.discountTotal, 5_000, "ONE reduction across two part lines");
  const editedDraft = ppfDraft((d) => { d.review.quantityInputsByLine[BONNET] = "3"; });
  const edited = computeWizardPricingFromConfig(editedDraft, PPF_PC, PPF_CATALOG, "detailer");
  assert.equal(edited.completeness, "complete");
  const bonnet = edited.lines.find((l) => wizardPricingLineId(l) === BONNET)!;
  assert.deepEqual([bonnet.quantity, bonnet.unitPrice, bonnet.lineTotal], [3, 50_000, 150_000]);
  assert.equal(edited.subtotal, 60_000 + 150_000 + 25_000);
  assert.equal(edited.discountTotal, 5_000, "still exactly one reduction");
  assert.equal(edited.taxableSubtotal, edited.subtotal, "post-tax discount rule preserved");
  const mapped = mapWizardDraftToSaveRequestFromConfig({ draft: editedDraft, pricingResult: edited, pricingConfig: PPF_PC, catalog: PPF_CATALOG, shopRank: "detailer" });
  assert.equal(mapped.ok, true);
  if (!mapped.ok) return;
  const saved = mapped.request.services.find((s) => s.lineId === BONNET)!;
  assert.deepEqual([saved.quantity, saved.unitPrice, saved.subtotal], [3, 50_000, 150_000]);
  assert.equal(saved.metadata.ppfCoatingAdjustmentReductionYen, 5_000, "reduction metadata on the first part line");
  assert.equal(mapped.request.services.find((s) => s.lineId === "manual:ppf:ppf_r1_partial_t1_fender")?.metadata.ppfCoatingAdjustmentReductionYen, undefined);
});

test("Stage B: out-of-bounds / malformed review text on a partial part line fails closed; the stale aggregate id is ignored; full PPF stays fixed", () => {
  for (const q of ["5", "0", "abc", "", "03", "1.5"]) {
    expectRejected(computeWizardPricingFromConfig(ppfDraft((d) => { d.review.quantityInputsByLine[BONNET] = q; }), PPF_PC, PPF_CATALOG, "detailer"), `bonnet=${q}`);
  }
  const canonical = computeWizardPricingFromConfig(ppfDraft(), PPF_PC, PPF_CATALOG, "detailer");
  const stale = computeWizardPricingFromConfig(ppfDraft((d) => {
    d.review.quantityInputsByLine["manual:ppf:ppf_r1_partial_t1"] = "9"; // pre-Stage-B aggregate id
    d.review.serviceLineOrder = ["manual:ppf:ppf_r1_partial_t1", BONNET];
  }), PPF_PC, PPF_CATALOG, "detailer");
  assert.deepEqual(totalsOf(stale), totalsOf(canonical), "old aggregate ids are ignored, never applied to a part line");
  const full = ppfDraft((d) => { d.serviceConfiguration.ppf = { ...d.serviceConfiguration.ppf, installationMethod: "full", fullCoverage: "full_body" }; });
  const fullResult = computeWizardPricingFromConfig(full, PPF_PC, PPF_CATALOG, "detailer");
  assert.equal(fullResult.completeness, "complete");
  const bundle = buildWizardPricingInputFromConfig(full, PPF_PC, PPF_CATALOG, "detailer");
  assert.equal(reviewQuantityPolicyForLine(fullResult.lines.find((l) => l.category === "ppf")!, bundle, PPF_PC), null);
  expectRejected(computeWizardPricingFromConfig({ ...full, review: { ...full.review, quantityInputsByLine: { "manual:ppf:ppf_r1_full_body_t1": "2" } } }, PPF_PC, PPF_CATALOG, "detailer"), "full-body fixed");
  // Malformed bounds in a (hypothetically tampered) source line ⇒ fixed, fail closed.
  const partBundle = buildWizardPricingInputFromConfig(ppfDraft(), PPF_PC, PPF_CATALOG, "detailer");
  const line = canonical.lines.find((l) => wizardPricingLineId(l) === BONNET)!;
  const broken = { manualLines: partBundle.manualLines.map((m) => (m.manualPricingIdentity.endsWith("bonnet") ? { ...m, metadata: { ...m.metadata, ppfPartMinQuantity: 0 } } : m)) };
  assert.equal(reviewQuantityPolicyForLine(line, broken, PPF_PC), null);
});

// ── GDA-ESTIMATE-QUANTITY-POLICY-R1 (B5c2, plan §24.1) — DEDICATED wheel / glass menu lines at final review ──

const DEDICATED_PC: ConfiguredPricingConfiguration = {
  ...PC,
  wheelMenus: [
    { code: "wm1", label: "ホイールコート", minQuantity: 1, maxQuantity: null, unitPriceConfigured: true },
    { code: "wm2", label: "ホイール撥水", minQuantity: 2, maxQuantity: 8, unitPriceConfigured: true },
  ],
  glassMenus: [
    { code: "gm1", label: "ガラス撥水", minQuantity: 1, maxQuantity: 6, unitPriceConfigured: false },
  ],
};
const WM1 = "manual:wheel:wm1";
const WM2 = "manual:wheel:wm2";
const GM1 = "manual:glass:gm1";
/** Step-4 canonical state after B5b2 selection: wheel initial 4 / glass initial 1, operator prices. */
const dedicatedDraft = (over?: (d: EstimateWizardDraftV22) => void) => draft((d) => {
  d.serviceSelection.selectedCategories = ["coating", "maintenance", "wheel", "glass"];
  d.serviceConfiguration.wheel = { selectedMenuIds: ["wm1", "wm2"], unitPricesByMenu: { wm1: "8000", wm2: "3000" }, quantitiesByMenu: { wm1: 4, wm2: 4 } };
  d.serviceConfiguration.glass = { selectedMenuIds: ["gm1"], unitPricesByMenu: { gm1: "12000" }, quantitiesByMenu: { gm1: 1 } };
  over?.(d);
});

test("B5c2: multiple wheel / glass menu identities price at 4 / 1 and are annotated editable with the configured bounds + dedicatedMenu; every other line stays fixed", () => {
  const d = dedicatedDraft();
  const canonical = computeWizardPricingFromConfig(d, DEDICATED_PC, CATALOG, "detailer");
  assert.equal(canonical.completeness, "complete", "PRECONDITION: the dedicated draft prices cleanly");
  const byId = (id: string) => canonical.lines.find((l) => wizardPricingLineId(l) === id)!;
  assert.deepEqual([byId(WM1).quantity, byId(WM1).unitPrice, byId(WM1).lineTotal], [4, 8_000, 32_000], "wheel: unit × 4");
  assert.deepEqual([byId(WM2).quantity, byId(WM2).unitPrice, byId(WM2).lineTotal], [4, 3_000, 12_000]);
  assert.deepEqual([byId(GM1).quantity, byId(GM1).unitPrice, byId(GM1).lineTotal], [1, 12_000, 12_000], "glass: unit × 1");
  assert.equal(byId(WM1).category, "wheel");
  assert.equal(byId(GM1).category, "glass");
  assert.deepEqual(byId(WM1).quantityPolicy, { minQuantity: 1, maxQuantity: null, dedicatedMenu: { kind: "wheel", menuCode: "wm1" } });
  assert.deepEqual(byId(WM2).quantityPolicy, { minQuantity: 2, maxQuantity: 8, dedicatedMenu: { kind: "wheel", menuCode: "wm2" } });
  assert.deepEqual(byId(GM1).quantityPolicy, { minQuantity: 1, maxQuantity: 6, dedicatedMenu: { kind: "glass", menuCode: "gm1" } });
  assert.equal(byId(WM1).quantityPolicy?.ppfPartCode, undefined, "never both sync hints");
  assert.equal(byId("catalog:coating:base:pure-evo").quantityPolicy, null, "body coating fixed");
  assert.equal(byId("manual:maintenance:mm1").quantityPolicy, null, "maintenance fixed");
  // The annotation IS the rule.
  const bundle = buildWizardPricingInputFromConfig(d, DEDICATED_PC, CATALOG, "detailer");
  for (const line of canonical.lines) assert.deepEqual(line.quantityPolicy, reviewQuantityPolicyForLine(line, bundle, DEDICATED_PC), line.sourceId);
});

test("B5c2: a valid in-bounds review quantity on a wheel / glass line recomputes unit × quantity, subtotal, coupon, discount and tax through the canonical engine", () => {
  const canonical = computeWizardPricingFromConfig(dedicatedDraft(), DEDICATED_PC, CATALOG, "detailer");
  const coatingTotal = canonical.lines.find((l) => l.kind === "catalog")!.lineTotal as number;
  const editedDraft = dedicatedDraft((d) => {
    d.review.quantityInputsByLine[WM1] = "5";   // unbounded above
    d.review.quantityInputsByLine[WM2] = "2";   // min bound, inclusive
    d.review.quantityInputsByLine[GM1] = "6";   // max bound, inclusive
  });
  const edited = computeWizardPricingFromConfig(editedDraft, DEDICATED_PC, CATALOG, "detailer");
  assert.equal(edited.completeness, "complete");
  const byId = (id: string) => edited.lines.find((l) => wizardPricingLineId(l) === id)!;
  assert.deepEqual([byId(WM1).quantity, byId(WM1).unitPrice, byId(WM1).lineTotal], [5, 8_000, 40_000]);
  assert.deepEqual([byId(WM2).quantity, byId(WM2).unitPrice, byId(WM2).lineTotal], [2, 3_000, 6_000]);
  assert.deepEqual([byId(GM1).quantity, byId(GM1).unitPrice, byId(GM1).lineTotal], [6, 12_000, 72_000]);
  const subtotal = coatingTotal + 5_000 + 40_000 + 6_000 + 72_000;
  assert.equal(edited.subtotal, subtotal);
  assert.notEqual(edited.subtotal, canonical.subtotal, "the edit really changed the subtotal");
  assertCouponCountedOnce(edited, 1_000, percentOfYen(subtotal, 1_000));
  // Every other line is untouched by the dedicated edits (same quantity / unit price / total).
  assert.deepEqual(byId("catalog:coating:base:pure-evo"), canonical.lines.find((l) => l.kind === "catalog"));
  assert.deepEqual(byId("manual:maintenance:mm1"), canonical.lines.find((l) => wizardPricingLineId(l) === "manual:maintenance:mm1"));
  // NOTE (B5c3 scope): persisting the wheel / glass lines through the production save mapper
  // (`estimate-save-mapper-from-config`) is the SEPARATE B5c3 save/revision packet — not pinned here.
});

test("B5c2: blank / malformed / out-of-bounds review text on a wheel / glass line fails the WHOLE result closed with the bounds message; identity text is accepted", () => {
  const cases: ReadonlyArray<readonly [string, string, string]> = [
    [WM1, "0", "数量は1以上の整数"], [WM1, "", "数量は1以上の整数"], [WM1, "abc", "数量は1以上の整数"], [WM1, "04", "数量は1以上の整数"], [WM1, "1.5", "数量は1以上の整数"],
    [WM2, "1", "2〜8の範囲"], [WM2, "9", "2〜8の範囲"],
    [GM1, "7", "1〜6の範囲"], [GM1, "0", "数量は1以上の整数"],
  ];
  for (const [id, q, message] of cases) {
    const r = computeWizardPricingFromConfig(dedicatedDraft((d) => { d.review.quantityInputsByLine[id] = q; }), DEDICATED_PC, CATALOG, "detailer");
    expectRejected(r, `${id}=${JSON.stringify(q)}`);
    assert.ok(r.errors.some((e) => e.message.includes(message)), `${id}=${JSON.stringify(q)}: ${message}`);
  }
  const canonical = computeWizardPricingFromConfig(dedicatedDraft(), DEDICATED_PC, CATALOG, "detailer");
  const identity = computeWizardPricingFromConfig(dedicatedDraft((d) => {
    d.review.quantityInputsByLine[WM1] = "4"; d.review.quantityInputsByLine[WM2] = "4"; d.review.quantityInputsByLine[GM1] = "1";
  }), DEDICATED_PC, CATALOG, "detailer");
  assert.deepEqual(totalsOf(identity), totalsOf(canonical));
  assert.deepEqual(identity.lines, canonical.lines);
});

test("B5c2: a later Step-4 quantity change is the canonical value the review reconciles to — the same text is an identity, a different text is an edit from the NEW base", () => {
  // Step 4 later moves wm1 from 4 to 6 (the hook clears the stale buffer; here the buffer is gone).
  const after = computeWizardPricingFromConfig(dedicatedDraft((d) => { d.serviceConfiguration.wheel!.quantitiesByMenu.wm1 = 6; }), DEDICATED_PC, CATALOG, "detailer");
  assert.equal(after.completeness, "complete");
  assert.equal(after.lines.find((l) => wizardPricingLineId(l) === WM1)?.quantity, 6);
  assert.equal(after.lines.find((l) => wizardPricingLineId(l) === WM1)?.lineTotal, 48_000);
  // A review edit that equals the new canonical value is an identity; a different one is a real edit.
  const same = computeWizardPricingFromConfig(dedicatedDraft((d) => { d.serviceConfiguration.wheel!.quantitiesByMenu.wm1 = 6; d.review.quantityInputsByLine[WM1] = "6"; }), DEDICATED_PC, CATALOG, "detailer");
  assert.deepEqual(totalsOf(same), totalsOf(after));
  const moved = computeWizardPricingFromConfig(dedicatedDraft((d) => { d.serviceConfiguration.wheel!.quantitiesByMenu.wm1 = 6; d.review.quantityInputsByLine[WM1] = "3"; }), DEDICATED_PC, CATALOG, "detailer");
  assert.equal(moved.lines.find((l) => wizardPricingLineId(l) === WM1)?.lineTotal, 24_000);
  // A Step-4 quantity outside the configured bounds never reaches a line at all (B5c1), so no review edit can rescue it.
  const oob = computeWizardPricingFromConfig(dedicatedDraft((d) => { d.serviceConfiguration.glass!.quantitiesByMenu.gm1 = 7; d.review.quantityInputsByLine[GM1] = "6"; }), DEDICATED_PC, CATALOG, "detailer");
  assert.notEqual(oob.completeness, "complete");
  assert.equal(oob.lines.some((l) => wizardPricingLineId(l) === GM1), false, "no glass line is invented for an out-of-bounds canonical quantity");
});

test("B5c2: reviewQuantityPolicyForLine fails closed on a stale / unknown / disagreeing / malformed source or configuration; PPF and store-option policies are unchanged", () => {
  const d = dedicatedDraft((sd) => selectOption(sd, "go-q", "3000", 2));
  const bundle = buildWizardPricingInputFromConfig(d, DEDICATED_PC, CATALOG, "detailer");
  const result = computeWizardPricingFromConfig(d, DEDICATED_PC, CATALOG, "detailer");
  const wheel = result.lines.find((l) => wizardPricingLineId(l) === WM2)!;
  const glass = result.lines.find((l) => wizardPricingLineId(l) === GM1)!;
  const tamper = (edit: (m: ConfigPricingInputBundle["manualLines"][number]) => ConfigPricingInputBundle["manualLines"][number]) =>
    ({ manualLines: bundle.manualLines.map((m) => (m.sourceCategory === "wheel" && m.manualPricingIdentity === "wm2" ? edit(m) : m)) });

  assert.deepEqual(reviewQuantityPolicyForLine(wheel, bundle, DEDICATED_PC), { minQuantity: 2, maxQuantity: 8, dedicatedMenu: { kind: "wheel", menuCode: "wm2" } });
  // No backing source line ⇒ fixed (never inferred from category/label).
  assert.equal(reviewQuantityPolicyForLine(wheel, { manualLines: [] }, DEDICATED_PC), null);
  // Configuration no longer carries the menu / the whole collection / disagreeing bounds ⇒ fixed.
  assert.equal(reviewQuantityPolicyForLine(wheel, bundle, { ...DEDICATED_PC, wheelMenus: DEDICATED_PC.wheelMenus!.filter((m) => m.code !== "wm2") }), null, "unknown code");
  assert.equal(reviewQuantityPolicyForLine(wheel, bundle, { ...DEDICATED_PC, wheelMenus: undefined }), null, "absent collection");
  assert.equal(reviewQuantityPolicyForLine(wheel, bundle, { ...DEDICATED_PC, wheelMenus: [] }), null, "empty collection");
  assert.equal(reviewQuantityPolicyForLine(wheel, bundle, { ...DEDICATED_PC, wheelMenus: [{ code: "wm2", label: "x", minQuantity: 1, maxQuantity: 8, unitPriceConfigured: true }] }), null, "bounds drifted (min)");
  assert.equal(reviewQuantityPolicyForLine(wheel, bundle, { ...DEDICATED_PC, wheelMenus: [{ code: "wm2", label: "x", minQuantity: 2, maxQuantity: null, unitPriceConfigured: true }] }), null, "bounds drifted (max)");
  assert.equal(reviewQuantityPolicyForLine(wheel, bundle, { ...DEDICATED_PC, wheelMenus: [{ code: "wm2", label: "x", minQuantity: 0, maxQuantity: 8, unitPriceConfigured: true }] }), null, "malformed configured min");
  assert.equal(reviewQuantityPolicyForLine(wheel, bundle, { ...DEDICATED_PC, wheelMenus: [{ code: "wm2", label: "x", minQuantity: 2, maxQuantity: 1, unitPriceConfigured: true }] }), null, "malformed configured max");
  // The glass menu is never resolved through the wheel collection (and vice versa).
  assert.equal(reviewQuantityPolicyForLine(glass, bundle, { ...DEDICATED_PC, glassMenus: [], wheelMenus: [...DEDICATED_PC.wheelMenus!, { code: "gm1", label: "x", minQuantity: 1, maxQuantity: 6, unitPriceConfigured: false }] }), null);
  // Tampered / stale source metadata ⇒ fixed.
  assert.equal(reviewQuantityPolicyForLine(wheel, tamper((m) => ({ ...m, metadata: { ...m.metadata, quantityRequired: false } })), DEDICATED_PC), null, "quantityRequired false");
  assert.equal(reviewQuantityPolicyForLine(wheel, tamper((m) => ({ ...m, metadata: { ...m.metadata, menuKind: "glass_menu" } })), DEDICATED_PC), null, "wrong menuKind");
  assert.equal(reviewQuantityPolicyForLine(wheel, tamper((m) => ({ ...m, metadata: { menuKind: "wheel_menu", quantityRequired: true } })), DEDICATED_PC), null, "no source bounds");
  assert.equal(reviewQuantityPolicyForLine(wheel, tamper((m) => ({ ...m, metadata: { ...m.metadata, minQuantity: 3 } })), DEDICATED_PC), null, "source bounds disagree");
  assert.equal(reviewQuantityPolicyForLine(wheel, tamper((m) => ({ ...m, metadata: { ...m.metadata, maxQuantity: 1.5 } })), DEDICATED_PC), null, "malformed source max");
  // A wheel result line whose source is a store option with the same code can never earn the dedicated policy.
  const option = result.lines.find((l) => l.sourceId === "store_global_options:go-q")!;
  assert.deepEqual(reviewQuantityPolicyForLine(option, bundle, DEDICATED_PC), { minQuantity: 1, maxQuantity: 5 }, "store-option policy unchanged (no dedicatedMenu)");
  assert.equal(reviewQuantityPolicyForLine({ ...option, category: "wheel", sourceId: "wheel:go-q" }, bundle, DEDICATED_PC), null);
  // Stale ids (a deselected menu) are ignored, never applied.
  const canonical = computeWizardPricingFromConfig(dedicatedDraft(), DEDICATED_PC, CATALOG, "detailer");
  const stale = computeWizardPricingFromConfig(dedicatedDraft((sd) => { sd.review.quantityInputsByLine["manual:wheel:wm9"] = "9"; sd.review.quantityInputsByLine["manual:glass:wm1"] = "9"; }), DEDICATED_PC, CATALOG, "detailer");
  assert.deepEqual(totalsOf(stale), totalsOf(canonical));
  // PPF regression: the partial part policy and the fixed full-body policy are byte-identical with the dedicated collections present.
  const ppfWithDedicated: ConfiguredPricingConfiguration = { ...PPF_PC, wheelMenus: DEDICATED_PC.wheelMenus, glassMenus: DEDICATED_PC.glassMenus };
  const ppfBundle = buildWizardPricingInputFromConfig(ppfDraft(), ppfWithDedicated, PPF_CATALOG, "detailer");
  const ppfResult = computeWizardPricingFromConfig(ppfDraft(), ppfWithDedicated, PPF_CATALOG, "detailer");
  assert.deepEqual(reviewQuantityPolicyForLine(ppfResult.lines.find((l) => wizardPricingLineId(l) === BONNET)!, ppfBundle, ppfWithDedicated), { minQuantity: 1, maxQuantity: 4, ppfPartCode: "bonnet" });
  assert.deepEqual(totalsOf(ppfResult), totalsOf(computeWizardPricingFromConfig(ppfDraft(), PPF_PC, PPF_CATALOG, "detailer")));
});

// ── GDA-OTHER-COATINGS-R1 (C4) — DISTINCT `other_coating` menu lines at final review ──

const OC_PC: ConfiguredPricingConfiguration = {
  ...DEDICATED_PC,
  otherCoatingMenus: [
    { code: "oc1", label: "樹脂パーツコーティング",     quantityRequired: false, minQuantity: null, maxQuantity: null, unitPriceConfigured: true },
    { code: "oc2", label: "シートコーティング",         quantityRequired: true,  minQuantity: 1,    maxQuantity: 5,    unitPriceConfigured: true },
    { code: "oc3", label: "エンジンルームコーティング", quantityRequired: true,  minQuantity: null, maxQuantity: null, unitPriceConfigured: false },
  ],
};
const OC1 = "manual:other_coating:oc1";
const OC2 = "manual:other_coating:oc2";
const OC3 = "manual:other_coating:oc3";
/** The B5c2 dedicated draft (coating + maintenance + wheel + glass, ¥1,000 authored discount + 10% coupon) plus the C3 other-coating section. */
const ocDraft = (over?: (d: EstimateWizardDraftV22) => void) => dedicatedDraft((d) => {
  d.serviceSelection.selectedCategories = ["coating", "maintenance", "wheel", "glass", "other_coating"];
  d.serviceConfiguration.otherCoating = {
    selectedMenuIds: ["oc1", "oc2", "oc3"],
    unitPricesByMenu: { oc1: "6000", oc2: "4000", oc3: "2500" },
    quantitiesByMenu: { oc1: 1, oc2: 2, oc3: 3 },
  };
  over?.(d);
});
const OC_SUBTOTAL_DELTA = 6_000 + 2 * 4_000 + 3 * 2_500; // 21,500

test("C4: fixed-one prices 1 × unit and is annotated null; quantity-bearing prices unit × n with bounds + dedicatedMenu other_coating; wheel / glass / coating policies unchanged; coupon and authored discount counted once", () => {
  const canonical = computeWizardPricingFromConfig(ocDraft(), OC_PC, CATALOG, "detailer");
  assert.equal(canonical.completeness, "complete", "PRECONDITION: the other-coating draft prices cleanly");
  assert.deepEqual(canonical.errors, []);
  const byId = (id: string) => canonical.lines.find((l) => wizardPricingLineId(l) === id)!;
  assert.deepEqual([byId(OC1).category, byId(OC1).label, byId(OC1).quantity, byId(OC1).unitPrice, byId(OC1).lineTotal], ["other_coating", "樹脂パーツコーティング", 1, 6_000, 6_000]);
  assert.equal(byId(OC1).quantityPolicy, null, "fixed-one: read-only quantity");
  assert.deepEqual([byId(OC2).quantity, byId(OC2).unitPrice, byId(OC2).lineTotal], [2, 4_000, 8_000], "unit × 2");
  assert.deepEqual(byId(OC2).quantityPolicy, { minQuantity: 1, maxQuantity: 5, dedicatedMenu: { kind: "other_coating", menuCode: "oc2" } });
  assert.deepEqual([byId(OC3).quantity, byId(OC3).lineTotal], [3, 7_500]);
  assert.deepEqual(byId(OC3).quantityPolicy, { minQuantity: 1, maxQuantity: null, dedicatedMenu: { kind: "other_coating", menuCode: "oc3" } });
  // B5 no regression: the wheel / glass policies and lines are exactly what the dedicated run produced.
  const dedicated = computeWizardPricingFromConfig(dedicatedDraft(), DEDICATED_PC, CATALOG, "detailer");
  const dedicatedById = (id: string) => dedicated.lines.find((l) => wizardPricingLineId(l) === id)!;
  for (const id of [WM1, WM2, GM1]) assert.deepEqual(byId(id), dedicatedById(id), id);
  assert.equal(canonical.lines.filter((l) => l.category === "coating").length, dedicated.lines.filter((l) => l.category === "coating").length, "no body-coating double count");
  assert.equal(canonical.lines.some((l) => l.category === "store_global_options"), false, "no store-option fallback");
  // Discount / tax consistency through the canonical engine.
  assert.equal(canonical.subtotal, (dedicated.subtotal as number) + OC_SUBTOTAL_DELTA);
  assertCouponCountedOnce(canonical, 1_000, percentOfYen(canonical.subtotal as number, 1_000));
});

test("C4: a valid in-bounds review quantity on a quantity-bearing line recomputes unit × quantity, subtotal, coupon, discount and tax; a unit-price edit on the fixed-one line keeps quantity 1", () => {
  const d = ocDraft((sd) => { sd.review.quantityInputsByLine[OC2] = "4"; sd.review.unitPriceInputsByLine[OC1] = "7000"; });
  const edited = computeWizardPricingFromConfig(d, OC_PC, CATALOG, "detailer");
  assert.equal(edited.status, "success");
  const byId = (id: string) => edited.lines.find((l) => wizardPricingLineId(l) === id)!;
  assert.deepEqual([byId(OC2).quantity, byId(OC2).unitPrice, byId(OC2).lineTotal], [4, 4_000, 16_000]);
  assert.deepEqual([byId(OC1).quantity, byId(OC1).unitPrice, byId(OC1).lineTotal], [1, 7_000, 7_000], "fixed-one: price editable, quantity stays 1");
  assert.deepEqual([byId(OC3).quantity, byId(OC3).lineTotal], [3, 7_500], "untouched line unchanged");
  const canonical = computeWizardPricingFromConfig(ocDraft(), OC_PC, CATALOG, "detailer");
  assert.equal(edited.subtotal, (canonical.subtotal as number) + 8_000 + 1_000);
  assertCouponCountedOnce(edited, 1_000, percentOfYen(edited.subtotal as number, 1_000));
  assert.deepEqual(byId(OC2).quantityPolicy, canonical.lines.find((l) => wizardPricingLineId(l) === OC2)!.quantityPolicy, "annotation survives the edit");
  // The same edit through the pure rule with the adapter bundle gives the identical totals.
  const bundle = buildWizardPricingInputFromConfig(ocDraft(), OC_PC, CATALOG, "detailer");
  const viaRule = applyWizardReviewLineAdjustments(canonical, bundle, { quantityInputsByLine: { [OC2]: "4" }, unitPriceInputsByLine: { [OC1]: "7000" } }, CATALOG, OC_PC);
  assert.deepEqual(totalsOf(viaRule), totalsOf(edited));
});

test("C4: a quantity change on the fixed-one line is rejected; blank / malformed / out-of-bounds text on a quantity-bearing line fails the WHOLE result closed; identity text is accepted; stale ids are ignored", () => {
  const fixed = computeWizardPricingFromConfig(ocDraft((d) => { d.review.quantityInputsByLine[OC1] = "2"; }), OC_PC, CATALOG, "detailer");
  expectRejected(fixed, "fixed-one quantity change");
  assert.ok(fixed.errors.some((e) => e.message === "「樹脂パーツコーティング」の数量は変更できません。"));
  for (const q of ["0", "6", "99", "-1", "1.5", "abc", "04"]) {
    const r = computeWizardPricingFromConfig(ocDraft((d) => { d.review.quantityInputsByLine[OC2] = q; }), OC_PC, CATALOG, "detailer");
    expectRejected(r, `oc2 "${q}"`);
  }
  const outOfBounds = computeWizardPricingFromConfig(ocDraft((d) => { d.review.quantityInputsByLine[OC2] = "6"; }), OC_PC, CATALOG, "detailer");
  assert.ok(outOfBounds.errors.some((e) => e.message === "「シートコーティング」の数量は1〜5の範囲で入力してください。"), "bounds message");
  const belowUnbounded = computeWizardPricingFromConfig(ocDraft((d) => { d.review.quantityInputsByLine[OC3] = "0"; }), OC_PC, CATALOG, "detailer");
  expectRejected(belowUnbounded, "oc3 0");
  const blank = computeWizardPricingFromConfig(ocDraft((d) => { d.review.quantityInputsByLine[OC2] = ""; }), OC_PC, CATALOG, "detailer");
  expectRejected(blank, "blank");
  // identity text on every other-coating line (fixed-one included) is accepted and reproduces canonical
  const canonical = computeWizardPricingFromConfig(ocDraft(), OC_PC, CATALOG, "detailer");
  const identity = computeWizardPricingFromConfig(ocDraft((d) => { d.review.quantityInputsByLine[OC1] = "1"; d.review.quantityInputsByLine[OC2] = "2"; d.review.quantityInputsByLine[OC3] = "3"; }), OC_PC, CATALOG, "detailer");
  assert.deepEqual(totalsOf(identity), totalsOf(canonical));
  // a deselected / foreign other-coating id is ignored, never applied
  const stale = computeWizardPricingFromConfig(ocDraft((d) => { d.review.quantityInputsByLine["manual:other_coating:oc9"] = "9"; d.review.quantityInputsByLine["manual:wheel:oc2"] = "9"; }), OC_PC, CATALOG, "detailer");
  assert.deepEqual(totalsOf(stale), totalsOf(canonical));
});

test("C4: reviewQuantityPolicyForLine fails closed on an absent / empty collection, unknown code, a row flipped to fixed-one, drifted or malformed bounds; never resolved via the wheel / glass collections; B5 policies unchanged", () => {
  const bundle = buildWizardPricingInputFromConfig(ocDraft(), OC_PC, CATALOG, "detailer");
  const result = computeWizardPricingFromConfig(ocDraft(), OC_PC, CATALOG, "detailer");
  const oc2 = result.lines.find((l) => wizardPricingLineId(l) === OC2)!;
  const oc1 = result.lines.find((l) => wizardPricingLineId(l) === OC1)!;
  const rows = OC_PC.otherCoatingMenus!;
  const withRows = (menus: ConfiguredPricingConfiguration["otherCoatingMenus"]): ConfiguredPricingConfiguration => ({ ...OC_PC, otherCoatingMenus: menus });
  const tamper = (edit: (m: ConfigPricingInputBundle["manualLines"][number]) => ConfigPricingInputBundle["manualLines"][number]) =>
    ({ manualLines: bundle.manualLines.map((m) => (m.sourceCategory === "other_coating" && m.manualPricingIdentity === "oc2" ? edit(m) : m)) });

  assert.deepEqual(reviewQuantityPolicyForLine(oc2, bundle, OC_PC), { minQuantity: 1, maxQuantity: 5, dedicatedMenu: { kind: "other_coating", menuCode: "oc2" } });
  assert.equal(reviewQuantityPolicyForLine(oc1, bundle, OC_PC), null, "fixed-one row: never editable");
  assert.equal(reviewQuantityPolicyForLine(oc2, { manualLines: [] }, OC_PC), null, "no source line");
  assert.equal(reviewQuantityPolicyForLine(oc2, bundle, withRows(undefined)), null, "absent collection");
  assert.equal(reviewQuantityPolicyForLine(oc2, bundle, withRows([])), null, "empty collection");
  assert.equal(reviewQuantityPolicyForLine(oc2, bundle, withRows(rows.filter((m) => m.code !== "oc2"))), null, "unknown code");
  assert.equal(reviewQuantityPolicyForLine(oc2, bundle, withRows(rows.map((m) => (m.code === "oc2" ? { ...m, quantityRequired: false } : m)))), null, "row since made fixed-one");
  assert.equal(reviewQuantityPolicyForLine(oc2, bundle, withRows(rows.map((m) => (m.code === "oc2" ? { ...m, minQuantity: 2 } : m)))), null, "bounds drifted (min)");
  assert.equal(reviewQuantityPolicyForLine(oc2, bundle, withRows(rows.map((m) => (m.code === "oc2" ? { ...m, maxQuantity: null } : m)))), null, "bounds drifted (max)");
  assert.equal(reviewQuantityPolicyForLine(oc2, bundle, withRows(rows.map((m) => (m.code === "oc2" ? { ...m, minQuantity: 0 } : m)))), null, "malformed configured min");
  assert.equal(reviewQuantityPolicyForLine(oc2, bundle, withRows(rows.map((m) => (m.code === "oc2" ? { ...m, maxQuantity: 0 } : m)))), null, "malformed configured max");
  // Absent min on the row means 1 on BOTH sides — so the C4 builder's normalised source bounds still agree.
  const oc3 = result.lines.find((l) => wizardPricingLineId(l) === OC3)!;
  assert.deepEqual(reviewQuantityPolicyForLine(oc3, bundle, OC_PC), { minQuantity: 1, maxQuantity: null, dedicatedMenu: { kind: "other_coating", menuCode: "oc3" } });
  // The other-coating code is never resolved through the wheel / glass collections (and vice versa).
  assert.equal(reviewQuantityPolicyForLine(oc2, bundle, { ...withRows([]), wheelMenus: [...DEDICATED_PC.wheelMenus!, { code: "oc2", label: "x", minQuantity: 1, maxQuantity: 5, unitPriceConfigured: true }] }), null);
  const wheel = result.lines.find((l) => wizardPricingLineId(l) === WM2)!;
  assert.equal(reviewQuantityPolicyForLine(wheel, bundle, { ...OC_PC, wheelMenus: [], otherCoatingMenus: [...rows, { code: "wm2", label: "x", quantityRequired: true, minQuantity: 2, maxQuantity: 8, unitPriceConfigured: true }] }), null);
  // Tampered source lines fail closed.
  assert.equal(reviewQuantityPolicyForLine(oc2, tamper((m) => ({ ...m, metadata: { ...m.metadata, quantityRequired: false } })), OC_PC), null, "quantityRequired false");
  assert.equal(reviewQuantityPolicyForLine(oc2, tamper((m) => ({ ...m, metadata: { ...m.metadata, menuKind: "wheel_menu" } })), OC_PC), null, "wrong menuKind");
  assert.equal(reviewQuantityPolicyForLine(oc2, tamper((m) => ({ ...m, metadata: { menuKind: "other_coating_menu", quantityRequired: true } })), OC_PC), null, "no source bounds");
  assert.equal(reviewQuantityPolicyForLine(oc2, tamper((m) => ({ ...m, metadata: { ...m.metadata, maxQuantity: 6 } })), OC_PC), null, "source bounds disagree");
  // B5 no regression: the wheel / glass policies are unchanged with the other-coating collection present.
  assert.deepEqual(reviewQuantityPolicyForLine(wheel, bundle, OC_PC), { minQuantity: 2, maxQuantity: 8, dedicatedMenu: { kind: "wheel", menuCode: "wm2" } });
  const glass = result.lines.find((l) => wizardPricingLineId(l) === GM1)!;
  assert.deepEqual(reviewQuantityPolicyForLine(glass, bundle, OC_PC), { minQuantity: 1, maxQuantity: 6, dedicatedMenu: { kind: "glass", menuCode: "gm1" } });
});

test("C4: a later Step-4 other-coating quantity change is the canonical base the review reconciles to — the same text is an identity, a different text is an edit from the NEW base", () => {
  const after = computeWizardPricingFromConfig(ocDraft((d) => { d.serviceConfiguration.otherCoating!.quantitiesByMenu.oc2 = 4; }), OC_PC, CATALOG, "detailer");
  assert.equal(after.lines.find((l) => wizardPricingLineId(l) === OC2)!.quantity, 4);
  const same = computeWizardPricingFromConfig(ocDraft((d) => { d.serviceConfiguration.otherCoating!.quantitiesByMenu.oc2 = 4; d.review.quantityInputsByLine[OC2] = "4"; }), OC_PC, CATALOG, "detailer");
  assert.deepEqual(totalsOf(same), totalsOf(after));
  const moved = computeWizardPricingFromConfig(ocDraft((d) => { d.serviceConfiguration.otherCoating!.quantitiesByMenu.oc2 = 4; d.review.quantityInputsByLine[OC2] = "3"; }), OC_PC, CATALOG, "detailer");
  assert.equal(moved.lines.find((l) => wizardPricingLineId(l) === OC2)!.lineTotal, 12_000);
  assert.equal(moved.subtotal, (after.subtotal as number) - 4_000);
});

// ── GDA-OTHER-COATINGS-R1 (C5 F2) — ¥0 unit-price override on an other-coating menu line ──────────

test("C5 F2: a ¥0 override on an other_coating menu line (fixed-one AND quantity-bearing) fails the WHOLE result closed — via the pure adjuster (save path) and the compute route (preview) alike", () => {
  const canonical = computeWizardPricingFromConfig(ocDraft(), OC_PC, CATALOG, "detailer");
  const bundle = buildWizardPricingInputFromConfig(ocDraft(), OC_PC, CATALOG, "detailer");
  // PRECONDITION: the rule keys on the VERIFIED source metadata the C4 builder wrote, not on a label.
  for (const code of ["oc1", "oc2", "oc3"]) {
    const src = bundle.manualLines.find((m) => m.sourceCategory === "other_coating" && m.manualPricingIdentity === code)!;
    assert.equal(src.metadata.menuKind, "other_coating_menu", code);
  }
  for (const id of [OC1, OC2, OC3]) {
    for (const zero of ["0", "00"]) {
      const viaRule = applyWizardReviewLineAdjustments(canonical, bundle, { quantityInputsByLine: {}, unitPriceInputsByLine: { [id]: zero } }, CATALOG, OC_PC);
      expectRejected(viaRule, `${id} "${zero}" via the shared adjuster`);
      const viaCompute = computeWizardPricingFromConfig(ocDraft((d) => { d.review.unitPriceInputsByLine[id] = zero; }), OC_PC, CATALOG, "detailer");
      expectRejected(viaCompute, `${id} "${zero}" via the compute route`);
    }
  }
  const fixedZero = applyWizardReviewLineAdjustments(canonical, bundle, { quantityInputsByLine: {}, unitPriceInputsByLine: { [OC1]: "0" } }, CATALOG, OC_PC);
  assert.ok(fixedZero.errors.some((e) => e.message === "「樹脂パーツコーティング」の単価は1以上の整数で入力してください。"), "positive-price message on the fixed-one line");
  assert.ok(fixedZero.errors.some((e) => e.code === "INVALID_REVIEW_ADJUSTMENT"));
  const boundedZero = applyWizardReviewLineAdjustments(canonical, bundle, { quantityInputsByLine: {}, unitPriceInputsByLine: { [OC2]: "0" } }, CATALOG, OC_PC);
  assert.ok(boundedZero.errors.some((e) => e.message === "「シートコーティング」の単価は1以上の整数で入力してください。"), "positive-price message on the quantity-bearing line");
  // A ¥0 combined with an otherwise valid quantity edit is still refused as a whole (no partial apply).
  expectRejected(applyWizardReviewLineAdjustments(canonical, bundle, { quantityInputsByLine: { [OC2]: "4" }, unitPriceInputsByLine: { [OC2]: "0" } }, CATALOG, OC_PC), "qty 4 + ¥0");
  // Negative / malformed text keeps the generic parse rejection (unchanged).
  for (const bad of ["-1", "1.5", "abc", ""]) expectRejected(applyWizardReviewLineAdjustments(canonical, bundle, { quantityInputsByLine: {}, unitPriceInputsByLine: { [OC1]: bad } }, CATALOG, OC_PC), `"${bad}"`);
});

test("C5 F2: a POSITIVE override (¥1 included) on other-coating lines is accepted and recomputed through the canonical engine; identity price text reproduces canonical", () => {
  const canonical = computeWizardPricingFromConfig(ocDraft(), OC_PC, CATALOG, "detailer");
  const bundle = buildWizardPricingInputFromConfig(ocDraft(), OC_PC, CATALOG, "detailer");
  const positive = applyWizardReviewLineAdjustments(canonical, bundle, { quantityInputsByLine: {}, unitPriceInputsByLine: { [OC1]: "1", [OC2]: "7000" } }, CATALOG, OC_PC);
  assert.equal(positive.status, "success");
  assert.deepEqual(positive.errors, []);
  const byId = (id: string) => positive.lines.find((l) => wizardPricingLineId(l) === id)!;
  assert.deepEqual([byId(OC1).quantity, byId(OC1).unitPrice, byId(OC1).lineTotal], [1, 1, 1], "fixed-one: ¥1 accepted, quantity stays 1");
  assert.deepEqual([byId(OC2).quantity, byId(OC2).unitPrice, byId(OC2).lineTotal], [2, 7_000, 14_000], "quantity-bearing: unit × 2");
  assert.equal(positive.subtotal, (canonical.subtotal as number) - 6_000 + 1 - 8_000 + 14_000);
  assertCouponCountedOnce(positive, 1_000, percentOfYen(positive.subtotal as number, 1_000));
  const viaCompute = computeWizardPricingFromConfig(ocDraft((d) => { d.review.unitPriceInputsByLine[OC1] = "1"; d.review.unitPriceInputsByLine[OC2] = "7000"; }), OC_PC, CATALOG, "detailer");
  assert.deepEqual(totalsOf(viaCompute), totalsOf(positive), "preview and save agree");
  const identity = applyWizardReviewLineAdjustments(canonical, bundle, { quantityInputsByLine: {}, unitPriceInputsByLine: { [OC1]: "6000", [OC2]: "4000", [OC3]: "2500" } }, CATALOG, OC_PC);
  assert.deepEqual(totalsOf(identity), totalsOf(canonical));
});

test("C5 F2: wheel / glass / maintenance ¥0 overrides keep their EXISTING behaviour (0 accepted, line priced at ¥0) — the rule is scoped to the verified other_coating_menu source only", () => {
  const canonical = computeWizardPricingFromConfig(ocDraft(), OC_PC, CATALOG, "detailer");
  const bundle = buildWizardPricingInputFromConfig(ocDraft(), OC_PC, CATALOG, "detailer");
  const MM1 = "manual:maintenance:mm1";
  const zeros = { [WM1]: "0", [GM1]: "0", [MM1]: "0" };
  const others = applyWizardReviewLineAdjustments(canonical, bundle, { quantityInputsByLine: {}, unitPriceInputsByLine: zeros }, CATALOG, OC_PC);
  assert.equal(others.status, "success", "wheel / glass / maintenance ¥0 still accepted");
  assert.deepEqual(others.errors, []);
  const byId = (id: string) => others.lines.find((l) => wizardPricingLineId(l) === id)!;
  assert.deepEqual([byId(WM1).quantity, byId(WM1).unitPrice, byId(WM1).lineTotal], [4, 0, 0], "wheel ¥0 × 4");
  assert.deepEqual([byId(GM1).quantity, byId(GM1).unitPrice, byId(GM1).lineTotal], [1, 0, 0], "glass ¥0 × 1");
  assert.deepEqual([byId(MM1).unitPrice, byId(MM1).lineTotal], [0, 0], "maintenance ¥0");
  assert.equal(others.subtotal, (canonical.subtotal as number) - 32_000 - 12_000 - 5_000);
  // the other-coating lines in the same result are untouched
  for (const [id, total] of [[OC1, 6_000], [OC2, 8_000], [OC3, 7_500]] as const) assert.equal(byId(id).lineTotal, total, id);
  const viaCompute = computeWizardPricingFromConfig(ocDraft((d) => { Object.assign(d.review.unitPriceInputsByLine, zeros); }), OC_PC, CATALOG, "detailer");
  assert.deepEqual(totalsOf(viaCompute), totalsOf(others), "preview and save agree on the unchanged kinds");
  // B5 / store-option baseline without any other-coating rows: byte-identical acceptance of ¥0.
  const dedicated = computeWizardPricingFromConfig(dedicatedDraft(), DEDICATED_PC, CATALOG, "detailer");
  const dedicatedBundle = buildWizardPricingInputFromConfig(dedicatedDraft(), DEDICATED_PC, CATALOG, "detailer");
  const dedicatedZero = applyWizardReviewLineAdjustments(dedicated, dedicatedBundle, { quantityInputsByLine: {}, unitPriceInputsByLine: { [WM1]: "0", [GM1]: "0" } }, CATALOG, DEDICATED_PC);
  assert.equal(dedicatedZero.status, "success");
  assert.equal(dedicatedZero.subtotal, (dedicated.subtotal as number) - 32_000 - 12_000);
  // The rule keys on correlated source metadata: a corrupted wheel source tagged as an
  // other-coating menu is rejected more strictly (fail closed), never silently repriced at ¥0.
  const wheelTampered: ConfigPricingInputBundle = { ...bundle, manualLines: bundle.manualLines.map((m) => (m.sourceCategory === "wheel" && m.manualPricingIdentity === "wm1" ? { ...m, metadata: { ...m.metadata, menuKind: "other_coating_menu" } } : m)) };
  expectRejected(applyWizardReviewLineAdjustments(canonical, wheelTampered, { quantityInputsByLine: {}, unitPriceInputsByLine: { [WM1]: "0" } }, CATALOG, OC_PC), "the rule follows the source metadata, never the category label");
});
