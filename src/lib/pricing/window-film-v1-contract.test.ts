import assert from "node:assert/strict";
import test from "node:test";
import {
  WINDOW_FILM_V1_AREA_CODES,
  parseWindowFilmSettingsV1,
  type WindowFilmSettingsV1,
} from "./window-film-v1-contract";

function valid(): WindowFilmSettingsV1 {
  return {
    contractVersion: "1.0",
    revision: 3,
    areas: Object.fromEntries(
      WINDOW_FILM_V1_AREA_CODES.map((code, index) => [
        code,
        { priceYen: index === 0 ? 0 : index * 1_000, durationMinutes: 30, isActive: true },
      ]),
    ) as WindowFilmSettingsV1["areas"],
    packages: [
      { code: "all-windows", name: "全窓一括", priceYen: 80_000, durationMinutes: 240, isActive: true, displayOrder: 0 },
    ],
    options: [
      { code: "film-removal", name: "既存フィルム剥離", priceYen: 8_000, durationMinutes: 30, isActive: true, displayOrder: 0 },
    ],
  };
}

test("accepts the exact seven-area V1 contract and preserves zero", () => {
  const parsed = parseWindowFilmSettingsV1(valid());
  assert.deepEqual(Object.keys(parsed.areas), WINDOW_FILM_V1_AREA_CODES);
  assert.equal(parsed.areas["front-windshield"].priceYen, 0);
});

test("rejects missing or additional fixed areas", () => {
  const missing = valid() as unknown as { areas: Record<string, unknown> };
  delete missing.areas.sunroof;
  assert.throws(() => parseWindowFilmSettingsV1(missing), /missing keys: sunroof/);

  const extra = valid() as unknown as { areas: Record<string, unknown> };
  extra.areas.moonroof = { priceYen: 1, durationMinutes: 1, isActive: true };
  assert.throws(() => parseWindowFilmSettingsV1(extra), /unknown keys: moonroof/);
});

test("rejects active entries with unset price or duration", () => {
  const area = valid();
  area.areas.sunroof.priceYen = null;
  assert.throws(() => parseWindowFilmSettingsV1(area), /active item requires/);

  const pkg = valid();
  pkg.packages[0].durationMinutes = null;
  assert.throws(() => parseWindowFilmSettingsV1(pkg), /active item requires/);
});

test("rejects duplicate custom codes and display order", () => {
  const duplicateCode = valid();
  duplicateCode.options.push({ ...duplicateCode.options[0], displayOrder: 1 });
  assert.throws(() => parseWindowFilmSettingsV1(duplicateCode), /duplicate code/);

  const duplicateOrder = valid();
  duplicateOrder.options.push({ ...duplicateOrder.options[0], code: "cleaning", name: "追加清掃" });
  assert.throws(() => parseWindowFilmSettingsV1(duplicateOrder), /duplicate display order/);
});

test("rejects normalized duplicate active custom-item names", () => {
  const duplicateName = valid();
  duplicateName.packages.push({
    ...duplicateName.packages[0],
    code: "second-package",
    name: "全窓一括".toUpperCase(),
    displayOrder: 1,
  });
  assert.throws(
    () => parseWindowFilmSettingsV1(duplicateName),
    /duplicate active name after normalization/,
  );

  duplicateName.packages[1].isActive = false;
  assert.doesNotThrow(() => parseWindowFilmSettingsV1(duplicateName));
});
