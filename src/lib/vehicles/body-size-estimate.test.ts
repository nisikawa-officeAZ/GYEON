// GDA-COATING-V3.3-C1 — seven-size 3M classifier contract proof.
// Proves every existing 3M boundary transition is unchanged, that XL is now the terminal
// classification for every remaining finite value at/above the former last boundary, that
// unknown vehicles still never fabricate a result, and that no tested public function ever
// returns XXL.
//
// Run: node --import tsx --test src/lib/vehicles/body-size-estimate.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  adjacentBodySizeKeys,
  bodySizeRecommendationLevel,
  classifyThreeM,
  estimateBodySize,
  estimateBodySizeFromVehicleRegistrationOcr,
} from "./body-size-estimate";

// 1 — each existing boundary transition remains unchanged.
test("each existing 3M boundary transition remains unchanged", () => {
  assert.equal(classifyThreeM(6.89), "SS");
  assert.equal(classifyThreeM(6.9), "S");
  assert.equal(classifyThreeM(7.29), "S");
  assert.equal(classifyThreeM(7.3), "M");
  assert.equal(classifyThreeM(7.89), "M");
  assert.equal(classifyThreeM(7.9), "ML");
  assert.equal(classifyThreeM(8.29), "ML");
  assert.equal(classifyThreeM(8.3), "L");
  assert.equal(classifyThreeM(8.59), "L");
  assert.equal(classifyThreeM(8.6), "LL");
  assert.equal(classifyThreeM(8.89), "LL");
  assert.equal(classifyThreeM(8.9), "XL");
});

// 2 — 9.19 resolves to XL.
test("3M = 9.19 resolves to XL", () => {
  assert.equal(classifyThreeM(9.19), "XL");
});

// 3 — 9.2 resolves to XL.
test("3M = 9.2 resolves to XL", () => {
  assert.equal(classifyThreeM(9.2), "XL");
});

// 4 — a clearly larger finite value resolves to XL.
test("a clearly larger finite 3M value resolves to XL", () => {
  assert.equal(classifyThreeM(50), "XL");
  assert.equal(classifyThreeM(1000), "XL");
});

// 5 — explicit OCR dimensions producing a value above the last boundary resolve to XL.
test("explicit OCR dimensions above the last boundary resolve to XL", () => {
  const result = estimateBodySize({ lengthM: 3.2, widthM: 3.0, heightM: 3.0 }); // 3M = 9.2
  assert.equal(result.sizeKey, "XL");
  assert.equal(result.source, "OCR");
  assert.equal(result.threeM, 9.2);
  assert.deepEqual(result.adjacentSizeKeys, ["LL"]);
  assert.equal(result.requiresManualConfirmation, true);
});

test("invalid or incomplete dimensions fail closed instead of falling back to a maker estimate", () => {
  for (const dimensions of [
    { lengthM: 4.6, widthM: 1.8 },
    { lengthM: 4.6, widthM: 0, heightM: 1.5 },
    { lengthM: -4.6, widthM: 1.8, heightM: 1.5 },
    { lengthM: Number.NaN, widthM: 1.8, heightM: 1.5 },
  ]) {
    const result = estimateBodySize({ maker: "トヨタ", ...dimensions });
    assert.equal(result.sizeKey, null);
    assert.equal(result.source, null);
    assert.equal(result.requiresManualConfirmation, true);
  }
});

test("maker representative dimensions are a weak manual-review suggestion", () => {
  const result = estimateBodySize({ maker: "トヨタ" });
  assert.equal(result.source, "推測");
  assert.equal(result.requiresManualConfirmation, true);
  assert.match(result.basis, /参考候補/);
});

test("recommendation levels identify exact blue and adjacent yellow candidates", () => {
  const estimate = estimateBodySize({ lengthM: 4.3, widthM: 1.7, heightM: 1.5 });
  assert.equal(estimate.sizeKey, "M");
  assert.deepEqual(adjacentBodySizeKeys("M"), ["S", "ML"]);
  assert.equal(bodySizeRecommendationLevel("M", estimate), "recommended");
  assert.equal(bodySizeRecommendationLevel("S", estimate), "adjacent");
  assert.equal(bodySizeRecommendationLevel("ML", estimate), "adjacent");
  assert.equal(bodySizeRecommendationLevel("L", estimate), "neutral");
});

test("classifyThreeM rejects non-physical values", () => {
  for (const value of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.throws(() => classifyThreeM(value), RangeError);
  }
});

test("canonical OCR millimetres feed the shared 3M contract", () => {
  const result = estimateBodySizeFromVehicleRegistrationOcr({
    length_mm: 4600,
    width_mm: 1800,
    height_mm: 1500,
    dimension_confidence: 0.95,
  });
  assert.equal(result.threeM, 7.9);
  assert.equal(result.sizeKey, "ML");
  assert.equal(result.source, "OCR");
});

test("partial OCR dimensions never fall back to a maker representative size", () => {
  const result = estimateBodySizeFromVehicleRegistrationOcr({
    maker: "トヨタ",
    length_mm: 4600,
    width_mm: 1800,
  });
  assert.equal(result.sizeKey, null);
  assert.equal(result.source, null);
});

// 6 — an unknown vehicle without dimensions still returns sizeKey: null and does not fabricate a result.
test("an unknown vehicle without dimensions returns sizeKey: null and fabricates nothing", () => {
  const result = estimateBodySize({});
  assert.equal(result.sizeKey, null);
  assert.equal(result.threeM, null);
  assert.equal(result.source, null);
  assert.equal(typeof result.basis, "string");
});

// 7 — no result produced by the tested public functions equals XXL.
test("no result produced by classifyThreeM or estimateBodySize equals XXL", () => {
  for (const threeM of [1, 6.9, 7.3, 7.9, 8.3, 8.6, 8.9, 9.19, 9.2, 50, 1000]) {
    assert.notEqual(classifyThreeM(threeM), "XXL");
  }
  const ocr = estimateBodySize({ lengthM: 10, widthM: 10, heightM: 10 });
  assert.notEqual(ocr.sizeKey, "XXL");
  const unknown = estimateBodySize({});
  assert.notEqual(unknown.sizeKey, "XXL");
});
