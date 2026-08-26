import assert from "node:assert/strict";
import test from "node:test";

import type { PpfR1PriceSettings } from "./ppf-r1-price-contract";
import {
  PPF_COEFFICIENT_BP_IDENTITY,
  resolvePpfR1Price,
} from "./ppf-r1-price-resolution";

const SETTINGS: PpfR1PriceSettings = {
  contractVersion: "1.0",
  frontFullPricesBySize: {
    SS: 100_000, S: 110_000, M: 120_000, ML: 130_000,
    L: 140_000, LL: 150_000, XL: null,
  },
  fullBodyPricesBySize: {
    SS: 400_000, S: 450_000, M: 500_000, ML: 550_000,
    L: 600_000, LL: 650_000, XL: 700_000,
  },
  partialPartPrices: {
    bonnet: 40_000,
    "front-bumper": 50_000,
    "door-mirror": 0,
    roof: null,
  },
};

test("front-full and full-body use independent seven-size direct prices", () => {
  const front = resolvePpfR1Price(SETTINGS, { kind: "front_full", bodySize: "M" }, 10_000);
  const full = resolvePpfR1Price(SETTINGS, { kind: "full_body", bodySize: "M" }, 10_000);
  assert.deepEqual(front, {
    ok: true, scope: "front_full", bodySize: "M", basePriceYen: 120_000,
    installCoefficientBp: 10_000, vehicleCoefficientBp: 10_000, resolvedPriceYen: 120_000,
  });
  assert.equal(full.ok && full.resolvedPriceYen, 500_000);
});

test("applies installation and vehicle coefficients with one exact yen rounding", () => {
  const result = resolvePpfR1Price(
    SETTINGS,
    { kind: "front_full", bodySize: "SS" },
    12_500,
    11_000,
  );
  assert.equal(result.ok && result.resolvedPriceYen, 137_500);
  assert.equal(result.ok && result.installCoefficientBp, 12_500);
  assert.equal(result.ok && result.vehicleCoefficientBp, 11_000);
});

test("vehicle coefficient defaults to identity 1.0", () => {
  const result = resolvePpfR1Price(SETTINGS, { kind: "full_body", bodySize: "SS" }, 10_000);
  assert.equal(result.ok && result.vehicleCoefficientBp, PPF_COEFFICIENT_BP_IDENTITY);
  assert.equal(result.ok && result.resolvedPriceYen, 400_000);
});

test("partial scope sums configured parts and quantities before coefficients", () => {
  const result = resolvePpfR1Price(
    SETTINGS,
    {
      kind: "partial",
      parts: [
        { partCode: "bonnet", quantity: 1 },
        { partCode: "front-bumper", quantity: 2 },
        { partCode: "door-mirror", quantity: 2 },
      ],
    },
    12_000,
    10_000,
  );
  assert.equal(result.ok && result.basePriceYen, 140_000);
  assert.equal(result.ok && result.resolvedPriceYen, 168_000);
});

test("zero is an explicit price and null/absent is not configured", () => {
  const zero = resolvePpfR1Price(
    SETTINGS,
    { kind: "partial", parts: [{ partCode: "door-mirror", quantity: 1 }] },
    10_000,
  );
  assert.equal(zero.ok && zero.resolvedPriceYen, 0);

  assert.deepEqual(
    resolvePpfR1Price(SETTINGS, { kind: "front_full", bodySize: "XL" }, 10_000),
    { ok: false, reason: "SCOPE_PRICE_NOT_CONFIGURED" },
  );
  assert.deepEqual(
    resolvePpfR1Price(SETTINGS, { kind: "partial", parts: [{ partCode: "roof", quantity: 1 }] }, 10_000),
    { ok: false, reason: "PART_PRICE_NOT_CONFIGURED", partCode: "roof" },
  );
  assert.deepEqual(
    resolvePpfR1Price(SETTINGS, { kind: "partial", parts: [{ partCode: "trunk", quantity: 1 }] }, 10_000),
    { ok: false, reason: "PART_PRICE_NOT_CONFIGURED", partCode: "trunk" },
  );
});

test("fails closed for invalid size, empty/duplicate parts, quantities, and coefficients", () => {
  assert.deepEqual(
    resolvePpfR1Price(SETTINGS, { kind: "front_full", bodySize: "XXL" }, 10_000),
    { ok: false, reason: "INVALID_BODY_SIZE" },
  );
  assert.deepEqual(
    resolvePpfR1Price(SETTINGS, { kind: "partial", parts: [] }, 10_000),
    { ok: false, reason: "NO_PARTS_SELECTED" },
  );
  assert.deepEqual(
    resolvePpfR1Price(SETTINGS, { kind: "partial", parts: [
      { partCode: "bonnet", quantity: 1 }, { partCode: "bonnet", quantity: 1 },
    ] }, 10_000),
    { ok: false, reason: "DUPLICATE_PART", partCode: "bonnet" },
  );
  assert.deepEqual(
    resolvePpfR1Price(SETTINGS, { kind: "partial", parts: [{ partCode: "bonnet", quantity: 0 }] }, 10_000),
    { ok: false, reason: "INVALID_PART_QUANTITY", partCode: "bonnet" },
  );
  assert.deepEqual(
    resolvePpfR1Price(SETTINGS, { kind: "full_body", bodySize: "M" }, 0),
    { ok: false, reason: "INVALID_INSTALL_COEFFICIENT" },
  );
  assert.deepEqual(
    resolvePpfR1Price(SETTINGS, { kind: "full_body", bodySize: "M" }, 10_000, Number.NaN),
    { ok: false, reason: "INVALID_VEHICLE_COEFFICIENT" },
  );
});
