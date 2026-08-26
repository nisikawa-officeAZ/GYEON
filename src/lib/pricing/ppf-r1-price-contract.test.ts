import assert from "node:assert/strict";
import { test } from "node:test";

import { PPF_R1_BODY_SIZES, parsePpfR1PriceSettings } from "./ppf-r1-price-contract";

const sizePrices = (overrides: Record<string, unknown> = {}) => ({
  SS: null,
  S: 0,
  M: 300_000,
  ML: 330_000,
  L: 360_000,
  LL: 390_000,
  XL: 420_000,
  ...overrides,
});

type RawPpfR1Payload = {
  contractVersion: unknown;
  frontFullPricesBySize: Record<string, unknown>;
  fullBodyPricesBySize: Record<string, unknown>;
  partialPartPrices: Record<string, unknown>;
};

const valid = (): RawPpfR1Payload => ({
  contractVersion: "1.0",
  frontFullPricesBySize: sizePrices(),
  fullBodyPricesBySize: sizePrices({ M: 500_000 }),
  partialPartPrices: { bonnet: 40_000, "front-bumper": null, "door-mirror": 0 },
});

const clone = (): RawPpfR1Payload => structuredClone(valid());

test("body-size order is exactly SS/S/M/ML/L/LL/XL and excludes XXL", () => {
  assert.deepEqual(PPF_R1_BODY_SIZES, ["SS", "S", "M", "ML", "L", "LL", "XL"]);
  assert.equal(PPF_R1_BODY_SIZES.includes("XXL" as never), false);
});

test("parses the two independent seven-size panels and the partial-part map", () => {
  const result = parsePpfR1PriceSettings(valid());
  assert.equal(result.frontFullPricesBySize.SS, null);
  assert.equal(result.frontFullPricesBySize.S, 0);
  assert.equal(result.fullBodyPricesBySize.M, 500_000);
  assert.equal(result.partialPartPrices.bonnet, 40_000);
  assert.equal(result.partialPartPrices["front-bumper"], null);
  assert.equal(result.partialPartPrices["door-mirror"], 0);
  assert.notEqual(result.frontFullPricesBySize, result.fullBodyPricesBySize);
});

test("null means unconfigured and 0 means intentional free, and they remain distinct", () => {
  const result = parsePpfR1PriceSettings(valid());
  assert.notEqual(result.frontFullPricesBySize.SS, result.frontFullPricesBySize.S);
  assert.strictEqual(result.frontFullPricesBySize.SS, null);
  assert.strictEqual(result.frontFullPricesBySize.S, 0);
});

test("rejects unknown top-level and legacy five-map fields", () => {
  assert.throws(() => parsePpfR1PriceSettings({ ...valid(), plan_prices: {} }), /unknown keys/);
  assert.throws(() => parsePpfR1PriceSettings({ ...valid(), film_coeff: {} }), /unknown keys/);
  assert.throws(() => parsePpfR1PriceSettings({ ...valid(), rank_coeff: {} }), /unknown keys/);
  assert.throws(() => parsePpfR1PriceSettings({ ...valid(), glass_prices: {} }), /unknown keys/);
  assert.throws(() => parsePpfR1PriceSettings({ ...valid(), parts_prices: {} }), /unknown keys/);
});

test("rejects a wrong or missing contract version", () => {
  assert.throws(() => parsePpfR1PriceSettings({ ...valid(), contractVersion: 1.0 }), /expected 1.0/);
  const value = clone() as Record<string, unknown>;
  delete value.contractVersion;
  assert.throws(() => parsePpfR1PriceSettings(value), /missing keys/);
});

test("rejects missing, extra, and XXL size keys in either seven-size panel", () => {
  const missing = clone();
  delete (missing.frontFullPricesBySize as Record<string, unknown>).ML;
  assert.throws(() => parsePpfR1PriceSettings(missing), /missing keys: ML/);

  const extra = clone();
  (extra.fullBodyPricesBySize as Record<string, unknown>).XXL = 999_999;
  assert.throws(() => parsePpfR1PriceSettings(extra), /unknown keys: XXL/);
});

test("rejects negative, fractional, unsafe, non-finite, and non-number seven-size prices", () => {
  for (const invalid of [-1, 1.5, Number.MAX_SAFE_INTEGER + 1, Number.NaN, Number.POSITIVE_INFINITY, "300000", true]) {
    const value = clone();
    (value.frontFullPricesBySize as Record<string, unknown>).M = invalid;
    assert.throws(() => parsePpfR1PriceSettings(value));
  }
});

test("accepts canonical hyphenated/underscored codes and rejects unsafe partial-part codes", () => {
  const accepted = clone();
  accepted.partialPartPrices = { "front-bumper": 1000, mirror_l: 2000 };
  assert.deepEqual(parsePpfR1PriceSettings(accepted).partialPartPrices, {
    "front-bumper": 1000,
    mirror_l: 2000,
  });

  for (const code of ["", " padded ", "Hood", "hood!", "部位", "hood/bumper", "a".repeat(65)]) {
    const value = clone();
    value.partialPartPrices = { [code]: 1000 };
    assert.throws(() => parsePpfR1PriceSettings(value));
  }
});

test("accepts null, zero, and positive integer partial-part prices but rejects invalid ones", () => {
  const value = clone();
  value.partialPartPrices = { bonnet: null, "front-bumper": 0, "door-mirror": 12_345 };
  const result = parsePpfR1PriceSettings(value);
  assert.equal(result.partialPartPrices.bonnet, null);
  assert.equal(result.partialPartPrices["front-bumper"], 0);
  assert.equal(result.partialPartPrices["door-mirror"], 12_345);

  for (const invalid of [-1, 1.5, Number.MAX_SAFE_INTEGER + 1, Number.NaN, "1000"]) {
    const invalidValue = clone();
    invalidValue.partialPartPrices = { hood: invalid };
    assert.throws(() => parsePpfR1PriceSettings(invalidValue));
  }
});

test("does not invent prices for an empty partial-part map", () => {
  const value = clone();
  value.partialPartPrices = {};
  const result = parsePpfR1PriceSettings(value);
  assert.deepEqual(result.partialPartPrices, {});
});

test("requires exact object structures for both seven-size panels", () => {
  const value = clone() as Record<string, unknown>;
  value.frontFullPricesBySize = [];
  assert.throws(() => parsePpfR1PriceSettings(value), /expected an object/);

  const notObject = clone() as Record<string, unknown>;
  notObject.partialPartPrices = "not-an-object";
  assert.throws(() => parsePpfR1PriceSettings(notObject), /expected an object/);
});

test("returns detached validated objects rather than preserving mutable map references", () => {
  const input = valid();
  const result = parsePpfR1PriceSettings(input);
  assert.notEqual(result.frontFullPricesBySize, input.frontFullPricesBySize);
  assert.notEqual(result.fullBodyPricesBySize, input.fullBodyPricesBySize);
  assert.notEqual(result.partialPartPrices, input.partialPartPrices);
});
