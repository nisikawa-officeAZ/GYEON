import assert from "node:assert/strict";
import { test } from "node:test";

import {
  COATING_V34_BODY_SIZES,
  parseCoatingSettingsV34,
} from "./coating-v34-contract";

const prices = (overrides: Record<string, unknown> = {}) => ({
  SS: null,
  S: 0,
  M: 30_000,
  ML: 35_000,
  L: 40_000,
  LL: 45_000,
  XL: 50_000,
  ...overrides,
});

const valid = () => ({
  contractVersion: "3.4",
  baseProducts: [{ productId: "mohs-evo", active: true, pricesBySize: prices() }],
  layer2Products: [{ productId: "skin-evo", active: true, layer2PricesBySize: prices({ M: 20_000 }) }],
  layer3Products: [{ productId: "cancoat-evo", active: false, layer3PricesBySize: prices({ M: 10_000 }) }],
  option_prices: { polish: 30_000 },
  option_names: { polish: "ハードポリッシュ" },
});

const clone = () => structuredClone(valid());

test("body-size order is exactly SS/S/M/ML/L/LL/XL and excludes XXL", () => {
  assert.deepEqual(COATING_V34_BODY_SIZES, ["SS", "S", "M", "ML", "L", "LL", "XL"]);
  assert.equal(COATING_V34_BODY_SIZES.includes("XXL" as never), false);
});

test("parses three independent catalogs while preserving null and confirmed zero", () => {
  const result = parseCoatingSettingsV34(valid());
  assert.equal(result.baseProducts[0].pricesBySize.SS, null);
  assert.equal(result.baseProducts[0].pricesBySize.S, 0);
  assert.equal(result.layer2Products[0].layer2PricesBySize.M, 20_000);
  assert.equal(result.layer3Products[0].layer3PricesBySize.M, 10_000);
  assert.notEqual(
    result.layer2Products[0].layer2PricesBySize,
    result.layer3Products[0].layer3PricesBySize,
  );
});

test("rejects unknown top-level and legacy fields", () => {
  assert.throws(() => parseCoatingSettingsV34({ ...valid(), size_multipliers: {} }), /unknown keys/);
  assert.throws(() => parseCoatingSettingsV34({ ...valid(), topcoat_prices: {} }), /unknown keys/);
});

test("rejects a wrong or missing contract version", () => {
  assert.throws(() => parseCoatingSettingsV34({ ...valid(), contractVersion: 3.4 }), /expected 3.4/);
  const value = clone() as Record<string, unknown>;
  delete value.contractVersion;
  assert.throws(() => parseCoatingSettingsV34(value), /missing keys/);
});

test("rejects missing, extra, and XXL size keys", () => {
  const missing = clone();
  delete (missing.baseProducts[0].pricesBySize as Record<string, unknown>).ML;
  assert.throws(() => parseCoatingSettingsV34(missing), /missing keys: ML/);

  const extra = clone();
  (extra.baseProducts[0].pricesBySize as Record<string, unknown>).XXL = 60_000;
  assert.throws(() => parseCoatingSettingsV34(extra), /unknown keys: XXL/);
});

test("rejects unknown product keys and cross-layer price-map names", () => {
  const unknown = clone();
  (unknown.baseProducts[0] as Record<string, unknown>).name = "MOHS EVO";
  assert.throws(() => parseCoatingSettingsV34(unknown), /unknown keys: name/);

  const crossed = clone();
  const layer2 = crossed.layer2Products[0] as Record<string, unknown>;
  layer2.layer3PricesBySize = layer2.layer2PricesBySize;
  delete layer2.layer2PricesBySize;
  assert.throws(() => parseCoatingSettingsV34(crossed), /missing keys: layer2PricesBySize/);
});

test("rejects duplicate IDs independently within each catalog", () => {
  const value = clone();
  value.layer2Products.push(structuredClone(value.layer2Products[0]));
  assert.throws(() => parseCoatingSettingsV34(value), /duplicate product ID: skin-evo/);

  const sameIdAcrossDifferentLayers = clone();
  sameIdAcrossDifferentLayers.layer3Products[0].productId = "skin-evo";
  assert.doesNotThrow(() => parseCoatingSettingsV34(sameIdAcrossDifferentLayers));
});

test("rejects empty, padded, and non-string product IDs", () => {
  for (const productId of ["", " padded ", 42]) {
    const value = clone();
    (value.baseProducts[0] as Record<string, unknown>).productId = productId;
    assert.throws(() => parseCoatingSettingsV34(value), /product ID/);
  }
});

test("rejects invalid active flags", () => {
  for (const active of [1, "true", null]) {
    const value = clone();
    (value.layer3Products[0] as Record<string, unknown>).active = active;
    assert.throws(() => parseCoatingSettingsV34(value), /expected a boolean/);
  }
});

test("rejects negative, fractional, non-finite, and non-number prices", () => {
  for (const invalid of [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, "1000", true]) {
    const value = clone();
    (value.baseProducts[0].pricesBySize as Record<string, unknown>).M = invalid;
    assert.throws(() => parseCoatingSettingsV34(value));
  }
});

test("requires exact product and catalog structures", () => {
  const value = clone() as Record<string, unknown>;
  value.baseProducts = {};
  assert.throws(() => parseCoatingSettingsV34(value), /expected an array/);

  const product = clone();
  delete (product.baseProducts[0] as Record<string, unknown>).active;
  assert.throws(() => parseCoatingSettingsV34(product), /missing keys: active/);
});

test("strictly validates retained option price and name maps", () => {
  const negative = clone();
  negative.option_prices.polish = -1;
  assert.throws(() => parseCoatingSettingsV34(negative), /negative yen/);

  const nullPrice = clone() as unknown as { option_prices: Record<string, unknown> };
  nullPrice.option_prices.polish = null;
  assert.throws(() => parseCoatingSettingsV34(nullPrice), /finite integer yen/);

  const badName = clone();
  badName.option_names.polish = "";
  assert.throws(() => parseCoatingSettingsV34(badName), /non-empty string/);
});

test("returns detached validated objects rather than preserving mutable map references", () => {
  const input = valid();
  const result = parseCoatingSettingsV34(input);
  assert.notEqual(result.baseProducts[0].pricesBySize, input.baseProducts[0].pricesBySize);
  assert.notEqual(result.option_prices, input.option_prices);
  assert.notEqual(result.option_names, input.option_names);
});
