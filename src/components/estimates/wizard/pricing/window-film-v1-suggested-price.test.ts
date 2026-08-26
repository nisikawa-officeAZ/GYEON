import assert from "node:assert/strict";
import test from "node:test";

import { resetWizardDraft } from "../draft/wizard-draft-state";
import type { WizardScreenConfiguration } from "../contract/wizard-runtime-inputs";
import type { WindowFilmSettingsV1 } from "@/lib/pricing/window-film-v1-contract";
import {
  isWindowFilmV1RuntimeReady,
  reconcileWindowFilmUnitPriceInput,
  windowFilmV1SuggestedUnitPrice,
} from "../screens/window-film-v1-suggested-price";

const settings: WindowFilmSettingsV1 = {
  contractVersion: "1.0", revision: 1,
  areas: {
    "front-windshield": { priceYen: 30_000, durationMinutes: 60, isActive: true },
    "front-door-glass": { priceYen: null, durationMinutes: null, isActive: false },
    "rear-door-glass": { priceYen: null, durationMinutes: null, isActive: false },
    "triangular-window": { priceYen: null, durationMinutes: null, isActive: false },
    "quarter-glass": { priceYen: null, durationMinutes: null, isActive: false },
    "rear-glass": { priceYen: null, durationMinutes: null, isActive: false },
    sunroof: { priceYen: null, durationMinutes: null, isActive: false },
  },
  packages: [],
  options: [],
};

test("suggested UI price uses the same V1 resolver inputs", () => {
  const screen = {
    filmTypes: [{ id: "film-a", label: "A", installationCoefficientBp: 12_500 }],
    windowFilmSettings: settings,
  } as WizardScreenConfiguration;
  const draft = resetWizardDraft().serviceConfiguration.windowFilm;
  draft.filmTypeId = "film-a";
  draft.selectedAreaIds = ["front-windshield"];
  assert.equal(windowFilmV1SuggestedUnitPrice(screen, draft), 37_500);
  draft.selectedPackageCode = "missing";
  assert.equal(windowFilmV1SuggestedUnitPrice(screen, draft), null);
});

test("copies the suggestion into canonical input while preserving a manual override", () => {
  assert.equal(reconcileWindowFilmUnitPriceInput("", null, "37500"), "37500");
  assert.equal(reconcileWindowFilmUnitPriceInput("37500", "37500", "40000"), "40000");
  assert.equal(reconcileWindowFilmUnitPriceInput("39000", "37500", "40000"), null);
  assert.equal(reconcileWindowFilmUnitPriceInput("40000", "40000", null), "");
});

test("runtime readiness requires V1, a valid active film, and a complete active scope", () => {
  const ready = {
    filmTypes: [{ id: "film-a", label: "A", installationCoefficientBp: 12_500 }],
    windowFilmSettings: settings,
  } as WizardScreenConfiguration;
  assert.equal(isWindowFilmV1RuntimeReady(ready), true);
  assert.equal(isWindowFilmV1RuntimeReady({ ...ready, windowFilmSettings: null }), false);
  assert.equal(isWindowFilmV1RuntimeReady({ ...ready, filmTypes: [] }), false);
  assert.equal(isWindowFilmV1RuntimeReady({
    ...ready,
    windowFilmSettings: {
      ...settings,
      areas: Object.fromEntries(
        Object.entries(settings.areas).map(([code, area]) => [code, { ...area, isActive: false }]),
      ) as WindowFilmSettingsV1["areas"],
    },
  }), false);
});
