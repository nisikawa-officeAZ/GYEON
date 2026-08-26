import assert from "node:assert/strict";
import test from "node:test";

import { resetWizardDraft } from "../draft/wizard-draft-state";
import type { EstimateWizardDraftV22 } from "../draft/wizard-draft-types";
import { makePricingCatalog } from "@/lib/pricing/pricing-catalog";
import type { WindowFilmSettingsV1 } from "@/lib/pricing/window-film-v1-contract";
import {
  buildWizardPricingInputFromConfig,
  type ConfiguredPricingConfiguration,
} from "./wizard-pricing-input-adapter-config";

const SETTINGS: WindowFilmSettingsV1 = {
  contractVersion: "1.0",
  revision: 4,
  areas: {
    "front-windshield": { priceYen: 30_000, durationMinutes: 60, isActive: true },
    "front-door-glass": { priceYen: 20_000, durationMinutes: 40, isActive: true },
    "rear-door-glass": { priceYen: null, durationMinutes: null, isActive: false },
    "triangular-window": { priceYen: null, durationMinutes: null, isActive: false },
    "quarter-glass": { priceYen: null, durationMinutes: null, isActive: false },
    "rear-glass": { priceYen: 25_000, durationMinutes: 50, isActive: true },
    sunroof: { priceYen: null, durationMinutes: null, isActive: false },
  },
  packages: [{ code: "film-package-rear", name: "リアセット", priceYen: 50_000, durationMinutes: 100, isActive: true, displayOrder: 0 }],
  options: [{ code: "film-option-removal", name: "既存フィルム剥がし", priceYen: 8_000, durationMinutes: 30, isActive: true, displayOrder: 0 }],
};

const CONFIG: ConfiguredPricingConfiguration = {
  ppfMethods: [],
  filmTypes: [{ code: "film-premium", label: "プレミアムフィルム" }],
  maintenanceMenus: [],
  washMenus: [],
  roomCleaningMenus: [],
  storeGlobalOptions: [],
  installCoefficientBpByCode: { "film-premium": 12_500 },
};

function draft(over?: (value: EstimateWizardDraftV22) => void): EstimateWizardDraftV22 {
  const value = resetWizardDraft();
  value.serviceSelection.selectedCategories = ["window"];
  value.serviceConfiguration.windowFilm.filmTypeId = "film-premium";
  value.serviceConfiguration.windowFilm.selectedAreaIds = ["front-windshield", "front-door-glass"];
  over?.(value);
  return value;
}

test("V1 rounds area lines, adds direct-price options, and snapshots pricing provenance", () => {
  const result = buildWizardPricingInputFromConfig(
    draft((value) => {
      value.serviceConfiguration.windowFilm.selectedOptionIds = ["film-option-removal"];
      value.serviceConfiguration.windowFilm.optionQuantities = { "film-option-removal": 2 };
    }),
    CONFIG,
    makePricingCatalog({ windowFilmV1: SETTINGS }),
    "detailer",
  );

  assert.deepEqual(result.errors, []);
  assert.equal(result.manualLines.length, 1);
  assert.equal(result.manualLines[0]?.unitPrice, 78_500);
  assert.equal(result.manualLines[0]?.metadata.windowFilmBasePriceYen, 50_000);
  assert.equal(result.manualLines[0]?.metadata.windowFilmAdjustedBasePriceYen, 62_500);
  assert.equal(result.manualLines[0]?.metadata.windowFilmOptionPriceYen, 16_000);
  assert.equal(result.manualLines[0]?.metadata.windowFilmDurationMinutes, 160);
  assert.equal(result.manualLines[0]?.metadata.windowFilmSuggestedPriceYen, 78_500);
  assert.equal(result.manualLines[0]?.metadata.windowFilmFinalPriceYen, 78_500);
  assert.equal(result.manualLines[0]?.metadata.windowFilmTypeCode, "film-premium");
  assert.equal(
    result.manualLines[0]?.metadata.windowFilmOptionBasePricesYen,
    "film-option-removal:8000",
  );
  assert.equal(
    result.manualLines[0]?.metadata.windowFilmAreaBasePricesYen,
    "front-windshield:30000,front-door-glass:20000",
  );
});

test("a configured package is independent from area selection", () => {
  const result = buildWizardPricingInputFromConfig(
    draft((value) => {
      value.serviceConfiguration.windowFilm.selectedAreaIds = [];
      value.serviceConfiguration.windowFilm.selectedPackageCode = "film-package-rear";
    }),
    CONFIG,
    makePricingCatalog({ windowFilmV1: SETTINGS }),
    "detailer",
  );
  assert.deepEqual(result.errors, []);
  assert.equal(result.manualLines[0]?.unitPrice, 62_500);
  assert.equal(result.manualLines[0]?.metadata.windowFilmPackageCode, "film-package-rear");
  assert.equal(result.manualLines[0]?.metadata.windowFilmPackageBasePriceYen, 50_000);
});

test("package and area selection together fail closed", () => {
  const result = buildWizardPricingInputFromConfig(
    draft((value) => { value.serviceConfiguration.windowFilm.selectedPackageCode = "film-package-rear"; }),
    CONFIG,
    makePricingCatalog({ windowFilmV1: SETTINGS }),
    "detailer",
  );
  assert.equal(result.manualLines.length, 0);
  assert.ok(result.errors.some((entry) => entry.category === "window"));
});

test("missing V1 settings never revive legacy catalog prices or manual input", () => {
  const result = buildWizardPricingInputFromConfig(
    draft((value) => { value.serviceConfiguration.windowFilm.unitPriceInput = "999999"; }),
    CONFIG,
    makePricingCatalog(),
    "detailer",
  );
  assert.equal(result.manualLines.length, 0);
  assert.ok(result.errors.some((entry) => entry.category === "window"));
});

test("an explicit valid operator override replaces only the calculated total", () => {
  const result = buildWizardPricingInputFromConfig(
    draft((value) => { value.serviceConfiguration.windowFilm.unitPriceInput = "70000"; }),
    CONFIG,
    makePricingCatalog({ windowFilmV1: SETTINGS }),
    "detailer",
  );
  assert.deepEqual(result.errors, []);
  assert.equal(result.manualLines[0]?.unitPrice, 70_000);
  assert.equal(result.manualLines[0]?.metadata.windowFilmAdjustedBasePriceYen, 62_500);
  assert.equal(result.manualLines[0]?.metadata.windowFilmSuggestedPriceYen, 62_500);
  assert.equal(result.manualLines[0]?.metadata.windowFilmFinalPriceYen, 70_000);
  assert.equal(result.manualLines[0]?.metadata.windowFilmManualOverrideYen, 70_000);
});
