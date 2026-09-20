import assert from "node:assert/strict";
import test from "node:test";

import { orderByLineIds, wizardPricingLineId } from "./wizard-line-order";

test("operator order is applied while stale ids are ignored and new lines are appended", () => {
  const lines = [{ id: "a" }, { id: "b" }, { id: "c" }];
  assert.deepEqual(
    orderByLineIds(lines, ["stale", "c", "c", "a"], (line) => line.id).map((line) => line.id),
    ["c", "a", "b"],
  );
  assert.deepEqual(lines.map((line) => line.id), ["a", "b", "c"], "source order is immutable");
});

test("pricing line ids exactly match persistence identities", () => {
  assert.equal(wizardPricingLineId({
    kind: "catalog", category: "coating", sourceId: "ignored", label: "PURE EVO",
    quantity: 1, unitPrice: 1, lineSubtotal: 1, discountAmount: null, taxAmount: null,
    lineTotal: 1, pricingReferenceId: "pure-evo", catalogLineRole: "base",
  }), "catalog:coating:base:pure-evo");
  assert.equal(wizardPricingLineId({
    kind: "manual", category: "maintenance", sourceId: "maintenance:menu-a", label: "メンテナンス",
    quantity: 1, unitPrice: 1, lineSubtotal: 1, discountAmount: null, taxAmount: null,
    lineTotal: 1, pricingReferenceId: null, catalogLineRole: null,
  }), "manual:maintenance:menu-a");
});
