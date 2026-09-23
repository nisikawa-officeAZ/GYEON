import assert from "node:assert/strict";
import test from "node:test";

import type { ConfigPricingInputBundle } from "./wizard-pricing-input-adapter-config";
import {
  applyWizardReviewLineAdjustments,
  resolvedPpfCoatingReductionForLines,
} from "./wizard-review-line-adjustments";
import type { WizardPricingResult } from "./wizard-pricing-types";

const base: WizardPricingResult = {
  status: "success",
  completeness: "complete",
  currency: "JPY",
  lines: [
    {
      kind: "catalog", category: "coating", sourceId: "coating:PURE EVO", label: "PURE EVO",
      quantity: 1, unitPrice: 51_000, lineSubtotal: 51_000, lineTotal: 51_000,
      discountAmount: null, taxAmount: null, pricingReferenceId: "pure-evo", catalogLineRole: "base",
    },
    {
      kind: "manual", category: "maintenance", sourceId: "maintenance:mm1", label: "メンテナンス",
      quantity: 1, unitPrice: 15_300, lineSubtotal: 15_300, lineTotal: 15_300,
      discountAmount: null, taxAmount: null, pricingReferenceId: null, catalogLineRole: null,
    },
  ],
  unresolvedItems: [], subtotal: 66_300, discountTotal: 0, couponTotal: 0,
  taxableSubtotal: 66_300, taxTotal: 6_630, grandTotal: 72_930,
  warnings: [], errors: [], couponState: { status: "none" }, discountIntent: { mode: "none" },
};

const bundle = {
  discounts: { couponTotal: 0, extraAmount: 0, isDealer: false, dealerRate: 0 },
  taxRate: 10,
  couponApplications: [],
  ppfAdjustmentsByIdentity: {},
  discountIntent: { mode: "none" },
} as unknown as ConfigPricingInputBundle;

test("final-review quantity and unit-price edits recompute line and document totals", () => {
  const result = applyWizardReviewLineAdjustments(base, bundle, {
    quantityInputsByLine: { "catalog:coating:base:pure-evo": "2" },
    unitPriceInputsByLine: { "catalog:coating:base:pure-evo": "60000" },
  });

  assert.equal(result.lines[0]?.quantity, 2);
  assert.equal(result.lines[0]?.unitPrice, 60_000);
  assert.equal(result.lines[0]?.lineTotal, 120_000);
  assert.equal(result.subtotal, 135_300);
  assert.equal(result.taxTotal, 13_530);
  assert.equal(result.grandTotal, 148_830);
});

test("invalid final-review edits fail closed with null customer-facing totals", () => {
  const result = applyWizardReviewLineAdjustments(base, bundle, {
    quantityInputsByLine: { "catalog:coating:base:pure-evo": "0" },
    unitPriceInputsByLine: { "catalog:coating:base:pure-evo": "60000" },
  });

  assert.equal(result.status, "error");
  assert.equal(result.completeness, "error");
  assert.equal(result.grandTotal, null);
  assert.ok(result.errors.some((issue) => issue.code === "INVALID_REVIEW_ADJUSTMENT"));
});

test("PPF coating reduction snapshot follows the adjusted coating amount", () => {
  const adjusted = applyWizardReviewLineAdjustments(base, {
    ...bundle,
    ppfAdjustmentsByIdentity: {
      "ppf:front": {
        ruleId: "rule-1", ppfMethodCode: "front", coatingCode: "all",
        adjustmentType: "percent", adjustmentValue: 1_000, reductionYen: 5_100,
      },
    },
  }, {
    quantityInputsByLine: {},
    unitPriceInputsByLine: { "catalog:coating:base:pure-evo": "60000" },
  });

  assert.equal(resolvedPpfCoatingReductionForLines(adjusted.lines, {
    ppfAdjustmentsByIdentity: {
      "ppf:front": {
        ruleId: "rule-1", ppfMethodCode: "front", coatingCode: "all",
        adjustmentType: "percent", adjustmentValue: 1_000, reductionYen: 5_100,
      },
    },
  }), 6_000);
});
