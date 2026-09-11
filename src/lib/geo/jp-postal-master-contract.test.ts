import { test } from "node:test";
import assert from "node:assert/strict";

import {
  normalizeJpPostalCode,
  normalizeJpAddressInput,
  isNonSpecificTownText,
  buildJpPostalAddressKey,
  buildJpPostalAddressPrefixHead,
  JP_POSTAL_ADDRESS_PREFIX_HEAD_LENGTH,
  JP_POSTAL_NON_SPECIFIC_TOWN_TEXTS,
} from "./jp-postal-master-contract";

test("normalizeJpPostalCode accepts a plain 7-digit code", () => {
  assert.equal(normalizeJpPostalCode("1000001"), "1000001");
});

test("normalizeJpPostalCode strips a half-width hyphen", () => {
  assert.equal(normalizeJpPostalCode("100-0001"), "1000001");
});

test("normalizeJpPostalCode normalizes full-width digits and full-width hyphen", () => {
  assert.equal(normalizeJpPostalCode("１００－０００１"), "1000001");
});

test("normalizeJpPostalCode strips surrounding/embedded whitespace", () => {
  assert.equal(normalizeJpPostalCode(" 100 - 0001 "), "1000001");
});

test("normalizeJpPostalCode rejects too few digits", () => {
  assert.equal(normalizeJpPostalCode("100-000"), null);
});

test("normalizeJpPostalCode rejects too many digits", () => {
  assert.equal(normalizeJpPostalCode("1000-0001"), null);
});

test("normalizeJpPostalCode rejects non-digit characters", () => {
  assert.equal(normalizeJpPostalCode("100-000a"), null);
});

test("normalizeJpPostalCode rejects empty input", () => {
  assert.equal(normalizeJpPostalCode(""), null);
});

test("normalizeJpPostalCode rejects non-string input", () => {
  assert.equal(normalizeJpPostalCode(1000001 as unknown), null);
  assert.equal(normalizeJpPostalCode(null), null);
  assert.equal(normalizeJpPostalCode(undefined), null);
});

test("normalizeJpAddressInput normalizes full-width characters and collapses whitespace", () => {
  assert.equal(
    normalizeJpAddressInput("東京都　千代田区　丸の内１丁目"),
    "東京都千代田区丸の内1丁目",
  );
});

test("normalizeJpAddressInput unifies hyphen variants", () => {
  assert.equal(normalizeJpAddressInput("東京都千代田区丸の内１−１"), "東京都千代田区丸の内1-1");
});

test("normalizeJpAddressInput rejects whitespace-only input", () => {
  assert.equal(normalizeJpAddressInput("   "), null);
});

test("normalizeJpAddressInput rejects empty and non-string input", () => {
  assert.equal(normalizeJpAddressInput(""), null);
  assert.equal(normalizeJpAddressInput(42 as unknown), null);
});

test("isNonSpecificTownText matches all three official forms and nothing else", () => {
  for (const text of JP_POSTAL_NON_SPECIFIC_TOWN_TEXTS) {
    assert.equal(isNonSpecificTownText(text), true);
  }
  assert.equal(isNonSpecificTownText("丸の内"), false);
});

test("buildJpPostalAddressKey concatenates prefecture, city, and town with no separator", () => {
  assert.equal(
    buildJpPostalAddressKey({ prefectureKanji: "東京都", cityKanji: "千代田区", townKanji: "丸の内" }),
    "東京都千代田区丸の内",
  );
});

test("buildJpPostalAddressPrefixHead truncates to the fixed length", () => {
  const key = buildJpPostalAddressKey({ prefectureKanji: "東京都", cityKanji: "千代田区", townKanji: "丸の内" });
  const head = buildJpPostalAddressPrefixHead(key);
  assert.equal(head.length <= JP_POSTAL_ADDRESS_PREFIX_HEAD_LENGTH, true);
  assert.equal(key.startsWith(head), true);
});

test("buildJpPostalAddressPrefixHead never exceeds the fixed length for a short key", () => {
  const head = buildJpPostalAddressPrefixHead("短い");
  assert.equal(head, "短い");
});
