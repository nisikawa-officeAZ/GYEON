import { test } from "node:test";
import assert from "node:assert/strict";

import {
  addressWithoutLeadingPostal,
  normalizeJapanesePostalCode,
  postalCodeFromAddress,
} from "./postal-normalization";

test("accepts only a complete seven-digit Japanese postal code", () => {
  assert.equal(normalizeJapanesePostalCode("〒５２３−１２３４"), "523-1234");
  assert.equal(normalizeJapanesePostalCode("5231234"), "523-1234");
  assert.equal(normalizeJapanesePostalCode("523-"), null);
  assert.equal(normalizeJapanesePostalCode("523"), null);
});

test("reads a complete legacy postal prefix and removes it from the address", () => {
  const address = "〒５２３−１２３４ 滋賀県愛知郡愛荘町愛知川774-4";
  assert.equal(postalCodeFromAddress(address), "523-1234");
  assert.equal(addressWithoutLeadingPostal(address), "滋賀県愛知郡愛荘町愛知川774-4");
});

test("removes a visibly partial postal prefix without inventing missing digits", () => {
  const address = "〒523- 滋賀県愛知郡愛荘町愛知川７７４−４";
  assert.equal(postalCodeFromAddress(address), null);
  assert.equal(addressWithoutLeadingPostal(address), "滋賀県愛知郡愛荘町愛知川７７４−４");
});
