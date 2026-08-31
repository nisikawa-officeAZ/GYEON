// Vehicle-registration dimension extraction contract.
// Run: node --import tsx --test src/lib/vehicle-registration/ocr-dimensions-contract.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";

import { sanitizeVehicleRegistrationOcrResult, EXTRACTION_PROMPT } from "./ocr";

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

// ── printed 型式 field contract: prompt binds 車名/型式/型式指定番号/類別区分番号/原動機の型式 ──

test("the extraction prompt explicitly distinguishes 車名, 型式, 型式指定番号, 類別区分番号, and 原動機の型式", () => {
  for (const field of ["車名", "型式", "型式指定番号", "類別区分番号", "原動機の型式"]) {
    assert.ok(EXTRACTION_PROMPT.includes(field), `prompt must reference ${field}`);
  }
  assert.match(EXTRACTION_PROMPT, /vehicle_name:.*車名/);
  assert.match(EXTRACTION_PROMPT, /model:.*型式/);
  assert.match(EXTRACTION_PROMPT, /model_code:.*型式指定番号/);
});

test("the extraction prompt forbids substituting 類別区分番号/原動機の型式 into another output key", () => {
  assert.match(
    EXTRACTION_PROMPT,
    /類別区分番号・原動機の型式.*キーが存在しない.*他のどのキーにも代入せず/,
  );
});

test("the extraction prompt forbids model from receiving 車名/型式指定番号/類別区分番号/原動機の型式", () => {
  assert.match(
    EXTRACTION_PROMPT,
    /model:.*車名・型式指定番号・類別区分番号・原動機の型式を絶対に代入しない/,
  );
});

// ── sanitizer/review evidence remains the raw printed 型式 — no folding before operator review ──

test("sanitizer preserves a full-width printed 型式 verbatim (trim only, no NFKC folding)", () => {
  const result = sanitizeVehicleRegistrationOcrResult({ model: "　６ＢＡ－ＪＧ３　" });
  assert.equal(result.model, "６ＢＡ－ＪＧ３", "reviewed OCR evidence must remain the raw printed value");
});

test("sanitizer preserves the printed 型式指定番号 verbatim", () => {
  const result = sanitizeVehicleRegistrationOcrResult({ model_code: "19777" });
  assert.equal(result.model_code, "19777");
});
