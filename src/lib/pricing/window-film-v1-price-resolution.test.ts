import assert from "node:assert/strict";
import test from "node:test";
import { WINDOW_FILM_V1_AREA_CODES, type WindowFilmSettingsV1 } from "./window-film-v1-contract";
import { resolveWindowFilmV1Price } from "./window-film-v1-price-resolution";

const settings: WindowFilmSettingsV1 = {
  contractVersion: "1.0",
  revision: 1,
  areas: Object.fromEntries(
    WINDOW_FILM_V1_AREA_CODES.map((code, index) => [
      code,
      { priceYen: 10_000 + index * 1_000, durationMinutes: 20 + index, isActive: true },
    ]),
  ) as WindowFilmSettingsV1["areas"],
  packages: [
    { code: "all-windows", name: "全窓一括", priceYen: 70_000, durationMinutes: 180, isActive: true, displayOrder: 0 },
  ],
  options: [
    { code: "film-removal", name: "既存フィルム剥離", priceYen: 8_000, durationMinutes: 30, isActive: true, displayOrder: 0 },
  ],
};

test("rounds each adjusted area line before summing, then adds options without coefficient", () => {
  const result = resolveWindowFilmV1Price(
    settings,
    { areaCodes: ["front-windshield", "front-door-glass"], packageCode: null, options: [{ code: "film-removal", quantity: 2 }] },
    12_000,
  );
  assert.deepEqual(result, {
    ok: true,
    basePriceYen: 21_000,
    filmCoefficientBp: 12_000,
    adjustedBasePriceYen: 25_200,
    optionPriceYen: 16_000,
    totalPriceYen: 41_200,
    totalDurationMinutes: 101,
  });
});

test("rounds physical areas independently instead of rounding their combined base", () => {
  const oneYenAreas: WindowFilmSettingsV1 = {
    ...settings,
    areas: Object.fromEntries(
      WINDOW_FILM_V1_AREA_CODES.map((code) => [
        code,
        { priceYen: 1, durationMinutes: 1, isActive: true },
      ]),
    ) as WindowFilmSettingsV1["areas"],
  };
  const result = resolveWindowFilmV1Price(
    oneYenAreas,
    { areaCodes: ["front-windshield", "front-door-glass"], packageCode: null, options: [] },
    15_000,
  );
  assert.equal(result.ok && result.adjustedBasePriceYen, 4);
  assert.equal(result.ok && result.totalPriceYen, 4);
});

test("resolves a package and rejects package-area mixing", () => {
  const packageResult = resolveWindowFilmV1Price(
    settings,
    { areaCodes: [], packageCode: "all-windows", options: [] },
    10_000,
  );
  assert.equal(packageResult.ok && packageResult.totalPriceYen, 70_000);

  const mixed = resolveWindowFilmV1Price(
    settings,
    { areaCodes: ["rear-glass"], packageCode: "all-windows", options: [] },
    10_000,
  );
  assert.deepEqual(mixed, { ok: false, reason: "PACKAGE_AND_AREAS_SELECTED" });
});

test("fails closed for unset scope and invalid coefficients", () => {
  const inactive: WindowFilmSettingsV1 = {
    ...settings,
    areas: { ...settings.areas, sunroof: { priceYen: null, durationMinutes: null, isActive: false } },
  };
  assert.deepEqual(
    resolveWindowFilmV1Price(inactive, { areaCodes: ["sunroof"], packageCode: null, options: [] }, 10_000),
    { ok: false, reason: "AREA_NOT_CONFIGURED", code: "sunroof" },
  );
  assert.deepEqual(
    resolveWindowFilmV1Price(settings, { areaCodes: ["rear-glass"], packageCode: null, options: [] }, 999),
    { ok: false, reason: "INVALID_FILM_COEFFICIENT" },
  );
});
