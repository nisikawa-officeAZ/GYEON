// GDA-COATING-V3.3-C1 — seven-size vehicle-size contract, source-data proof.
// Proves BODY_SIZES, PPF_PLAN_PRICES, and DEFAULT_SERVICE_PRICE_SETTINGS.coating.size_multipliers
// contain exactly SS/S/M/ML/L/LL/XL in order, that every retained label/multiplier/price is
// byte-for-value unchanged, and that no inspected runtime structure contains an XXL key.
//
// Run: node --import tsx --test src/lib/pricing/body-size-contract.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";

import { BODY_SIZES, PPF_PLAN_PRICES } from "./pricing-data";
import { DEFAULT_SERVICE_PRICE_SETTINGS } from "@/lib/dealer-settings/dealer-settings-defaults";

const CANONICAL_SEVEN = ["SS", "S", "M", "ML", "L", "LL", "XL"];

// 1 — BODY_SIZES contains exactly the seven canonical keys, in order.
test("BODY_SIZES.map(size => size.key) exactly equals SS, S, M, ML, L, LL, XL in order", () => {
  assert.deepEqual(BODY_SIZES.map((size) => size.key), CANONICAL_SEVEN);
});

// 2 — retained labels and multipliers are unchanged.
test("retained BODY_SIZES labels and multipliers are unchanged", () => {
  const byKey = new Map(BODY_SIZES.map((size) => [size.key, size]));
  assert.equal(byKey.get("SS")?.name, "軽自動車");
  assert.equal(byKey.get("SS")?.multi, 0.75);
  assert.equal(byKey.get("S")?.name, "コンパクト");
  assert.equal(byKey.get("S")?.multi, 0.85);
  assert.equal(byKey.get("M")?.name, "セダン / HB");
  assert.equal(byKey.get("M")?.multi, 1.0);
  assert.equal(byKey.get("ML")?.name, "ミニバン S");
  assert.equal(byKey.get("ML")?.multi, 1.15);
  assert.equal(byKey.get("L")?.name, "ミニバン L");
  assert.equal(byKey.get("L")?.multi, 1.3);
  assert.equal(byKey.get("LL")?.name, "SUV / 大型");
  assert.equal(byKey.get("LL")?.multi, 1.5);
  assert.equal(byKey.get("XL")?.name, "高級大型");
  assert.equal(byKey.get("XL")?.multi, 1.7);
});

// 3 — every PPF_PLAN_PRICES plan has exactly those seven keys.
test("every PPF_PLAN_PRICES plan has exactly the seven canonical size keys", () => {
  for (const plan of Object.keys(PPF_PLAN_PRICES)) {
    assert.deepEqual(Object.keys(PPF_PLAN_PRICES[plan]).sort(), [...CANONICAL_SEVEN].sort());
  }
});

// 4 — retained PPF values are unchanged.
test("retained PPF_PLAN_PRICES values are unchanged", () => {
  assert.deepEqual(PPF_PLAN_PRICES["front-half"], {
    SS: 130000, S: 150000, M: 170000, ML: 180000,
    L: 190000, LL: 220000, XL: 260000,
  });
  assert.deepEqual(PPF_PLAN_PRICES["full-body"], {
    SS: 250000, S: 290000, M: 330000, ML: 350000,
    L: 370000, LL: 430000, XL: 520000,
  });
});

// 5 — DEFAULT_SERVICE_PRICE_SETTINGS.coating.size_multipliers has exactly those seven keys.
test("DEFAULT_SERVICE_PRICE_SETTINGS.coating.size_multipliers has exactly the seven canonical keys", () => {
  const multipliers = DEFAULT_SERVICE_PRICE_SETTINGS.coating.size_multipliers;
  assert.deepEqual(Object.keys(multipliers).sort(), [...CANONICAL_SEVEN].sort());
  assert.deepEqual(multipliers, {
    SS: 0.75, S: 0.85, M: 1.0, ML: 1.15,
    L: 1.3, LL: 1.5, XL: 1.7,
  });
});

// 6 — no inspected exported runtime structure in this test contains an XXL key.
test("no inspected runtime structure contains an XXL key", () => {
  assert.equal(BODY_SIZES.some((size) => size.key === "XXL"), false);
  for (const plan of Object.keys(PPF_PLAN_PRICES)) {
    assert.equal(Object.prototype.hasOwnProperty.call(PPF_PLAN_PRICES[plan], "XXL"), false);
  }
  assert.equal(
    Object.prototype.hasOwnProperty.call(DEFAULT_SERVICE_PRICE_SETTINGS.coating.size_multipliers, "XXL"),
    false,
  );
});
