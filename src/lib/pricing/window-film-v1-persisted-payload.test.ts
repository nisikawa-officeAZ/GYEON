import assert from "node:assert/strict";
import test from "node:test";
import { WINDOW_FILM_V1_AREA_CODES, type WindowFilmSettingsV1 } from "./window-film-v1-contract";
import {
  projectLegacyWindowFilmV1Draft,
  resolveStoredWindowFilmV1,
} from "./window-film-v1-persisted-payload";

const settings: WindowFilmSettingsV1 = {
  contractVersion: "1.0",
  revision: 0,
  areas: Object.fromEntries(
    WINDOW_FILM_V1_AREA_CODES.map((code) => [
      code,
      { priceYen: null, durationMinutes: null, isActive: false },
    ]),
  ) as WindowFilmSettingsV1["areas"],
  packages: [],
  options: [],
};

test("prefers V1 and does not expose unrelated siblings", () => {
  const result = resolveStoredWindowFilmV1({
    coating: { secret: true },
    window_film: { base_prices: {} },
    window_film_v1: settings,
  });
  assert.equal(result.status, "V1_READY");
  assert.equal("coating" in result, false);
});

test("classifies legacy, absent, and malformed states", () => {
  assert.equal(resolveStoredWindowFilmV1({ window_film: { base_prices: {} } }).status, "LEGACY_REVIEW_REQUIRED");
  assert.equal(resolveStoredWindowFilmV1({ coating: {} }).status, "NOT_CONFIGURED");
  assert.equal(resolveStoredWindowFilmV1({ window_film_v1: { contractVersion: "1.0" } }).status, "INVALID_STORED_PAYLOAD");
});

test("projects only the five unambiguous legacy prices into an unsaved review draft", () => {
  const draft = projectLegacyWindowFilmV1Draft({
    base_prices: {
      "wf-front-side": 10_000,
      "wf-rear-side": 20_000,
      "wf-rear": 30_000,
      "wf-quarter": 0,
      "wf-all": 70_000,
      "wf-unknown": 999_999,
    },
    grade_coeff: { premium: 1.5 },
  });
  assert.ok(draft);
  assert.deepEqual(draft.areas["front-door-glass"], {
    priceYen: 10_000, durationMinutes: null, isActive: false,
  });
  assert.equal(draft.areas["quarter-glass"].priceYen, 0);
  assert.equal(draft.areas["front-windshield"].priceYen, null);
  assert.deepEqual(draft.packages, [{
    code: "draft-package-legacy-wf-all",
    name: "全窓一括",
    priceYen: 70_000,
    durationMinutes: null,
    isActive: false,
    displayOrder: 0,
  }]);
  assert.equal("grade_coeff" in draft, false);
});
