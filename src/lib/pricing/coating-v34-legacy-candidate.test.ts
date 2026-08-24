import assert from "node:assert/strict";
import { test } from "node:test";

import type { CoatingSettings } from "@/lib/dealer-settings/dealer-settings-types";
import {
  confirmLegacyBaseCandidate,
  confirmLegacyUpperLayerCandidate,
  projectLegacyCoatingV34Candidates,
} from "./coating-v34-legacy-candidate";

function legacy(): CoatingSettings {
  return {
    products: [{
      id: "mohs-evo",
      name: "MOHS EVO",
      grade: "スタンダード",
      base_price_m: 60_001,
      certified_only: false,
      active: true,
    }],
    size_multipliers: { SS: 0.75, S: 0.85, M: 1, ML: 1.15, L: 1.3, LL: 1.5, XL: 1.7 },
    topcoat_prices: { "skin-evo": 20_001 },
    option_prices: { polish: 30_000 },
    option_names: { polish: "ハードポリッシュ" },
  };
}

test("projects base prices with the exact seven legacy multipliers and Math.round", () => {
  const result = projectLegacyCoatingV34Candidates(legacy());
  assert.deepEqual(result.baseProducts[0], {
    productId: "mohs-evo",
    active: true,
    candidatePricesBySize: {
      SS: 45_001,
      S: 51_001,
      M: 60_001,
      ML: 69_001,
      L: 78_001,
      LL: 90_002,
      XL: 102_002,
    },
    requiresConfirmation: true,
  });
});

test("keeps old topcoat prices position-unassigned instead of duplicating them", () => {
  const result = projectLegacyCoatingV34Candidates(legacy());
  assert.deepEqual(Object.keys(result), [
    "baseProducts",
    "unassignedUpperLayerProducts",
    "option_prices",
    "option_names",
  ]);
  assert.equal("layer2Products" in result, false);
  assert.equal("layer3Products" in result, false);
  assert.equal(result.unassignedUpperLayerProducts[0].requiresLayer2Confirmation, true);
  assert.equal(result.unassignedUpperLayerProducts[0].requiresLayer3Confirmation, true);
  assert.equal(result.unassignedUpperLayerProducts[0].candidatePricesBySize.M, 20_001);
});

test("requires separate explicit confirmation for layer 2 and layer 3", () => {
  const candidate = projectLegacyCoatingV34Candidates(legacy()).unassignedUpperLayerProducts[0];
  const layer2 = confirmLegacyUpperLayerCandidate(candidate, "layer2", true);
  const layer3 = confirmLegacyUpperLayerCandidate(candidate, "layer3", false);

  assert.deepEqual(Object.keys(layer2), ["productId", "active", "layer2PricesBySize"]);
  assert.deepEqual(Object.keys(layer3), ["productId", "active", "layer3PricesBySize"]);
  assert.notEqual(layer2.layer2PricesBySize, layer3.layer3PricesBySize);
  assert.equal(layer2.active, true);
  assert.equal(layer3.active, false);
});

test("base candidate also requires an explicit confirmation call", () => {
  const candidate = projectLegacyCoatingV34Candidates(legacy()).baseProducts[0];
  const confirmed = confirmLegacyBaseCandidate(candidate);
  assert.deepEqual(Object.keys(confirmed), ["productId", "active", "pricesBySize"]);
  assert.notEqual(confirmed.pricesBySize, candidate.candidatePricesBySize);
});

test("projection and confirmations do not mutate or share legacy input maps", () => {
  const input = legacy();
  const before = structuredClone(input);
  const result = projectLegacyCoatingV34Candidates(input);
  result.baseProducts[0].candidatePricesBySize.M = 999;
  result.option_prices.polish = 999;
  result.option_names.polish = "changed";
  assert.deepEqual(input, before);
});

test("confirmed zero is projected as zero and no default price is invented", () => {
  const input = legacy();
  input.products[0].base_price_m = 0;
  input.topcoat_prices["skin-evo"] = 0;
  const result = projectLegacyCoatingV34Candidates(input);
  assert.deepEqual(Object.values(result.baseProducts[0].candidatePricesBySize), Array(7).fill(0));
  assert.deepEqual(
    Object.values(result.unassignedUpperLayerProducts[0].candidatePricesBySize),
    Array(7).fill(0),
  );
});

test("rejects missing, extra, and XXL legacy size keys fail closed", () => {
  const missing = legacy();
  delete (missing.size_multipliers as Record<string, number>).ML;
  assert.throws(() => projectLegacyCoatingV34Candidates(missing), /missing=ML/);

  const xxl = legacy();
  (xxl.size_multipliers as Record<string, number>).XXL = 1.9;
  assert.throws(() => projectLegacyCoatingV34Candidates(xxl), /extra=XXL/);
});

test("rejects malformed legacy prices, multipliers, IDs, and active flags", () => {
  const badPrice = legacy();
  badPrice.products[0].base_price_m = -1;
  assert.throws(() => projectLegacyCoatingV34Candidates(badPrice), /Invalid legacy coating value/);

  const badMultiplier = legacy();
  badMultiplier.size_multipliers.M = 0;
  assert.throws(() => projectLegacyCoatingV34Candidates(badMultiplier), /multiplier/);

  const badId = legacy();
  badId.products[0].id = " ";
  assert.throws(() => projectLegacyCoatingV34Candidates(badId), /product ID/);

  const badActive = legacy();
  (badActive.products[0] as unknown as { active: unknown }).active = "true";
  assert.throws(() => projectLegacyCoatingV34Candidates(badActive), /active flag/);
});

test("rejects duplicate legacy base product IDs", () => {
  const input = legacy();
  input.products.push(structuredClone(input.products[0]));
  assert.throws(() => projectLegacyCoatingV34Candidates(input), /Duplicate legacy base product ID/);
});

test("does not emit legacy multiplier, M-base, flat-topcoat, XXL, or persistence fields", () => {
  const serialized = JSON.stringify(projectLegacyCoatingV34Candidates(legacy()));
  for (const forbidden of [
    "size_multipliers",
    "base_price_m",
    "topcoat_prices",
    "XXL",
    "save",
    "persist",
    "fallback",
  ]) {
    assert.equal(serialized.includes(forbidden), false, forbidden);
  }
});
