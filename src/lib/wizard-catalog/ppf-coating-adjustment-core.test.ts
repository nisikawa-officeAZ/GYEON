// B1.1 — unit tests for the pure PPF coefficient / PPF+coating adjustment core (no DB, no mocks).
// Run: node --import tsx --test src/lib/wizard-catalog/ppf-coating-adjustment-core.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  COEFFICIENT_BP_IDENTITY,
  applyInstallCoefficientBp,
  isValidInstallCoefficientBp,
  resolvePpfCoatingAdjustment,
  validatePpfCoatingAdjustmentRule,
  type PpfCoatingAdjustmentRule,
} from "./ppf-coating-adjustment-core";

// ── coefficient ──────────────────────────────────────────────────────────────

test("coefficient: 10000bp is the identity", () => {
  assert.equal(applyInstallCoefficientBp(50_000, COEFFICIENT_BP_IDENTITY), 50_000);
});

test("coefficient: scales and rounds with Math.round", () => {
  assert.equal(applyInstallCoefficientBp(50_000, 12_500), 62_500); // ×1.25
  assert.equal(applyInstallCoefficientBp(50_000, 8_000), 40_000);  // ×0.8
  assert.equal(applyInstallCoefficientBp(333, 10_050), 335);       // 334.665 → 335
});

test("coefficient: absent/invalid is the IDENTITY, never zero and never a discount", () => {
  for (const bad of [null, undefined, 0, -1, 1.5, Number.NaN]) {
    assert.equal(applyInstallCoefficientBp(50_000, bad as number | null | undefined), 50_000);
  }
});

test("coefficient: a negative or non-finite base yields 0, never a negative line", () => {
  assert.equal(applyInstallCoefficientBp(-1, 12_500), 0);
  assert.equal(applyInstallCoefficientBp(Number.NaN, 12_500), 0);
});

test("coefficient: only positive integers are valid", () => {
  assert.equal(isValidInstallCoefficientBp(10_000), true);
  assert.equal(isValidInstallCoefficientBp(1), true);
  for (const bad of [0, -1, 1.5, "10000", null, undefined]) {
    assert.equal(isValidInstallCoefficientBp(bad), false);
  }
});

// ── rule validation ──────────────────────────────────────────────────────────

const okInput = {
  ppfMethodCode: "full",
  coatingCode: "pure-evo",
  adjustmentType: "amount" as const,
  adjustmentValue: 30_000,
};

test("validate: accepts a well-formed amount rule", () => {
  assert.deepEqual(validatePpfCoatingAdjustmentRule(okInput), { ok: true });
});

test("validate: accepts a percent rule at exactly 100%", () => {
  const r = validatePpfCoatingAdjustmentRule({
    ...okInput,
    adjustmentType: "percent",
    adjustmentValue: COEFFICIENT_BP_IDENTITY,
  });
  assert.deepEqual(r, { ok: true });
});

test("validate: rejects a percent rule above 100%", () => {
  const r = validatePpfCoatingAdjustmentRule({
    ...okInput,
    adjustmentType: "percent",
    adjustmentValue: COEFFICIENT_BP_IDENTITY + 1,
  });
  assert.equal(r.ok === false && r.code, "INVALID_ADJUSTMENT_VALUE");
});

test("validate: rejects malformed codes", () => {
  assert.equal(
    validatePpfCoatingAdjustmentRule({ ...okInput, ppfMethodCode: "Full Coat" }).ok === false &&
      validatePpfCoatingAdjustmentRule({ ...okInput, ppfMethodCode: "Full Coat" }).ok,
    false,
  );
  const a = validatePpfCoatingAdjustmentRule({ ...okInput, ppfMethodCode: "" });
  assert.equal(a.ok === false && a.code, "INVALID_PPF_METHOD_CODE");
  const b = validatePpfCoatingAdjustmentRule({ ...okInput, coatingCode: "PURE EVO" });
  assert.equal(b.ok === false && b.code, "INVALID_COATING_CODE");
});

test("validate: rejects an unknown type and a negative/non-integer value", () => {
  const t = validatePpfCoatingAdjustmentRule({ ...okInput, adjustmentType: "ratio" });
  assert.equal(t.ok === false && t.code, "INVALID_ADJUSTMENT_TYPE");
  const n = validatePpfCoatingAdjustmentRule({ ...okInput, adjustmentValue: -1 });
  assert.equal(n.ok === false && n.code, "INVALID_ADJUSTMENT_VALUE");
  const f = validatePpfCoatingAdjustmentRule({ ...okInput, adjustmentValue: 1.5 });
  assert.equal(f.ok === false && f.code, "INVALID_ADJUSTMENT_VALUE");
});

// ── resolution ───────────────────────────────────────────────────────────────

const RULES: readonly PpfCoatingAdjustmentRule[] = [
  {
    ruleId: "r1",
    ppfMethodCode: "full",
    coatingCode: "pure-evo",
    adjustmentType: "amount",
    adjustmentValue: 30_000,
    isActive: true,
  },
  {
    ruleId: "r2",
    ppfMethodCode: "partial",
    coatingCode: "pure-evo",
    adjustmentType: "percent",
    adjustmentValue: 2_000, // 20%
    isActive: true,
  },
  {
    ruleId: "r3",
    ppfMethodCode: "full",
    coatingCode: "mohs-evo",
    adjustmentType: "amount",
    adjustmentValue: 10_000,
    isActive: false, // archived / disabled
  },
];

test("resolve: matches on the (method, coating) code pair and freezes the authored value", () => {
  const r = resolvePpfCoatingAdjustment("full", "pure-evo", RULES, 150_000);
  assert.deepEqual(r, {
    ruleId: "r1",
    ppfMethodCode: "full",
    coatingCode: "pure-evo",
    adjustmentType: "amount",
    adjustmentValue: 30_000,
    reductionYen: 30_000,
  });
});

test("resolve: percent rules compute against the base", () => {
  const r = resolvePpfCoatingAdjustment("partial", "pure-evo", RULES, 150_000);
  assert.equal(r?.reductionYen, 30_000); // 20% of 150,000
});

test("resolve: an inactive rule never applies", () => {
  assert.equal(resolvePpfCoatingAdjustment("full", "mohs-evo", RULES, 150_000), null);
});

test("resolve: no match, no coating, or a non-positive base yields null", () => {
  assert.equal(resolvePpfCoatingAdjustment("sunroof", "pure-evo", RULES, 150_000), null);
  assert.equal(resolvePpfCoatingAdjustment("full", null, RULES, 150_000), null);
  assert.equal(resolvePpfCoatingAdjustment("full", "", RULES, 150_000), null);
  assert.equal(resolvePpfCoatingAdjustment("full", "pure-evo", RULES, 0), null);
});

test("resolve: the reduction is clamped to the base — a rule can never drive a line negative", () => {
  const huge: readonly PpfCoatingAdjustmentRule[] = [
    { ...RULES[0], adjustmentValue: 999_999 },
  ];
  const r = resolvePpfCoatingAdjustment("full", "pure-evo", huge, 120_000);
  assert.equal(r?.reductionYen, 120_000);
});

test("resolve: the Ver2.2 worked example (150,000 → 120,000)", () => {
  const r = resolvePpfCoatingAdjustment("full", "pure-evo", RULES, 150_000);
  assert.equal(150_000 - (r?.reductionYen ?? 0), 120_000);
});
