// Vehicle-registration dimension extraction contract.
// Run: node --import tsx --test src/lib/vehicle-registration/ocr-dimensions-contract.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  enrichPostalCodesFromOfficialAddressData,
  sanitizeVehicleRegistrationOcrResult,
} from "./ocr";

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

test("sanitizes postal fields independently and removes legacy or partial address prefixes", () => {
  const complete = sanitizeVehicleRegistrationOcrResult({
    owner_postal_code: "〒５２３−１２３４",
    owner_address: "〒５２３−１２３４ 滋賀県愛知郡愛荘町愛知川774-4",
  });
  assert.equal(complete.owner_postal_code, "523-1234");
  assert.equal(complete.owner_address, "滋賀県愛知郡愛荘町愛知川774-4");

  const partial = sanitizeVehicleRegistrationOcrResult({
    owner_postal_code: "523-",
    owner_address: "〒523- 滋賀県愛知郡愛荘町愛知川774-4",
  });
  assert.equal(partial.owner_postal_code, undefined);
  assert.equal(partial.owner_address, "滋賀県愛知郡愛荘町愛知川774-4");
});

test("fills a missing OCR postal from the same address using official Japan Post data", () => {
  const result = enrichPostalCodesFromOfficialAddressData({
    owner_name: "有限会社 オフィスアズ",
    owner_address: "滋賀県愛知郡愛荘町愛知川７７４−４",
  });
  assert.equal(result.owner_postal_code, "529-1331");
  assert.equal(result.owner_address, "滋賀県愛知郡愛荘町愛知川７７４−４");
});
