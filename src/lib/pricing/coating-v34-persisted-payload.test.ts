import assert from "node:assert/strict";
import { test } from "node:test";

import { resolveStoredCoatingV34 } from "./coating-v34-persisted-payload";

const seven = (base: number | null = 1) => ({
  SS: base, S: base, M: base, ML: base, L: base, LL: base, XL: base,
});

const v34 = () => ({
  contractVersion: "3.4",
  baseProducts: [{ productId: "base", active: true, pricesBySize: seven(0) }],
  layer2Products: [{ productId: "second", active: true, layer2PricesBySize: seven(null) }],
  layer3Products: [{ productId: "third", active: false, layer3PricesBySize: seven(3) }],
  option_prices: { polish: 30_000 },
  option_names: { polish: "ポリッシュ" },
});

const legacy = () => ({
  products: [{
    id: "base",
    name: "Base",
    grade: "Standard",
    base_price_m: 10_000,
    certified_only: false,
    active: true,
  }],
  size_multipliers: { SS: 0.75, S: 0.85, M: 1, ML: 1.15, L: 1.3, LL: 1.5, XL: 1.7 },
  topcoat_prices: { upper: 5_000 },
  option_prices: { polish: 2_000 },
  option_names: { polish: "Polish" },
});

test("returns V34_READY only through the strict V3.4 parser", () => {
  const result = resolveStoredCoatingV34({ coating: v34(), ppf: { untouched: true } });
  assert.equal(result.status, "V34_READY");
  if (result.status === "V34_READY") {
    assert.equal(result.settings.baseProducts[0].pricesBySize.SS, 0);
    assert.equal(result.settings.layer2Products[0].layer2PricesBySize.SS, null);
    assert.equal("ppf" in result, false);
  }
});

test("returns LEGACY_REVIEW_REQUIRED without assigning flat topcoats to a layer", () => {
  const result = resolveStoredCoatingV34({ coating: legacy(), window_film: {} });
  assert.equal(result.status, "LEGACY_REVIEW_REQUIRED");
  if (result.status === "LEGACY_REVIEW_REQUIRED") {
    assert.equal(result.candidates.unassignedUpperLayerProducts[0].productId, "upper");
    assert.equal("layer2Products" in result.candidates, false);
    assert.equal("layer3Products" in result.candidates, false);
    assert.equal("window_film" in result, false);
  }
});

test("distinguishes absent settings from malformed settings", () => {
  assert.deepEqual(resolveStoredCoatingV34(null), { status: "NOT_CONFIGURED" });
  assert.deepEqual(resolveStoredCoatingV34({}), { status: "NOT_CONFIGURED" });
  assert.deepEqual(resolveStoredCoatingV34({ coating: null }), { status: "NOT_CONFIGURED" });
  assert.deepEqual(resolveStoredCoatingV34([]), { status: "INVALID_STORED_PAYLOAD" });
  assert.deepEqual(resolveStoredCoatingV34({ coating: [] }), { status: "INVALID_STORED_PAYLOAD" });
});

test("malformed V3.4 never falls back to legacy or defaults", () => {
  const malformed = v34() as Record<string, unknown>;
  malformed.XXL = 99;
  assert.deepEqual(resolveStoredCoatingV34({ coating: malformed }), {
    status: "INVALID_STORED_PAYLOAD",
  });
});

test("legacy shape is exact and rejects unknown fields", () => {
  assert.deepEqual(resolveStoredCoatingV34({ coating: { ...legacy(), extra: true } }), {
    status: "INVALID_STORED_PAYLOAD",
  });
  const productExtra = legacy();
  (productExtra.products[0] as Record<string, unknown>).unknown = true;
  assert.deepEqual(resolveStoredCoatingV34({ coating: productExtra }), {
    status: "INVALID_STORED_PAYLOAD",
  });
});

test("legacy XXL, missing sizes, invalid numbers, and duplicate products fail closed", () => {
  const xxl = legacy();
  (xxl.size_multipliers as Record<string, number>).XXL = 2;
  assert.equal(resolveStoredCoatingV34({ coating: xxl }).status, "INVALID_STORED_PAYLOAD");

  const missing = legacy();
  delete (missing.size_multipliers as Record<string, number>).ML;
  assert.equal(resolveStoredCoatingV34({ coating: missing }).status, "INVALID_STORED_PAYLOAD");

  const invalid = legacy();
  invalid.topcoat_prices.upper = -1;
  assert.equal(resolveStoredCoatingV34({ coating: invalid }).status, "INVALID_STORED_PAYLOAD");

  const duplicate = legacy();
  duplicate.products.push(structuredClone(duplicate.products[0]));
  assert.equal(resolveStoredCoatingV34({ coating: duplicate }).status, "INVALID_STORED_PAYLOAD");
});

test("does not return raw service-price siblings or invent persisted defaults", () => {
  const result = resolveStoredCoatingV34({ coating: legacy(), secretSibling: "not-returned" });
  const serialized = JSON.stringify(result);
  assert.equal(serialized.includes("secretSibling"), false);
  assert.equal(serialized.includes("DEFAULT"), false);
});
