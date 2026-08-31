// Vehicle-registration dimension extraction contract.
// Run: node --import tsx --test src/lib/vehicle-registration/ocr-dimensions-contract.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";

import { sanitizeVehicleRegistrationOcrResult } from "./ocr";

test("keeps valid vehicle dimensions as canonical integer millimetres", () => {
  const result = sanitizeVehicleRegistrationOcrResult({
    maker: " トヨタ ",
    length_mm: 4600.4,
    width_mm: 1800,
    height_mm: 1500,
    dimension_confidence: 0.92,
  });
  assert.equal(result.maker, "トヨタ");
  assert.equal(result.length_mm, 4600);
  assert.equal(result.width_mm, 1800);
  assert.equal(result.height_mm, 1500);
  assert.equal(result.dimension_confidence, 0.92);
});

test("rejects invalid dimensions, unit mistakes, and invalid confidence", () => {
  const result = sanitizeVehicleRegistrationOcrResult({
    length_mm: 4.6,
    width_mm: -1800,
    height_mm: Number.NaN,
    dimension_confidence: 1.2,
  });
  assert.equal(result.length_mm, undefined);
  assert.equal(result.width_mm, undefined);
  assert.equal(result.height_mm, undefined);
  assert.equal(result.dimension_confidence, undefined);
});

test("grade is manual-only: a nonblank OCR grade is discarded, never sanitized", () => {
  // grade remains a legacy-typed input field for backward compatibility, but the
  // sanitizer must never accept or emit it — grade is always manual.
  const result = sanitizeVehicleRegistrationOcrResult({
    maker: "トヨタ",
    grade: "アスリート",
  });
  assert.equal(result.maker, "トヨタ");
  assert.equal("grade" in result, false, "sanitizer must never emit grade");
});
