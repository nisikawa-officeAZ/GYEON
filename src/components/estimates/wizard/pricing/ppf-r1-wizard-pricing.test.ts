import assert from "node:assert/strict";
import test from "node:test";

import { resetWizardDraft } from "../draft/wizard-draft-state";
import type { EstimateWizardDraftV22 } from "../draft/wizard-draft-types";
import { makePricingCatalog } from "@/lib/pricing/pricing-catalog";
import type { PpfR1PriceSettings } from "@/lib/pricing/ppf-r1-price-contract";
import {
  buildWizardPricingInputFromConfig,
  type ConfiguredPricingConfiguration,
} from "./wizard-pricing-input-adapter-config";

const PPF_R1: PpfR1PriceSettings = {
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
    roof: null,
  },
};

const CONFIG: ConfiguredPricingConfiguration = {
  ppfMethods: [
    { code: "full", label: "外装フル施工" },
    { code: "partial", label: "部分施工" },
  ],
  ppfTypes: [{ code: "film-x", label: "PPF X" }],
  installCoefficientBpByCode: { "film-x": 12_500 },
  ppfCoatingAdjustments: [],
  filmTypes: [],
  maintenanceMenus: [],
  washMenus: [],
  roomCleaningMenus: [],
  storeGlobalOptions: [],
};

function draft(over?: (draft: EstimateWizardDraftV22) => void): EstimateWizardDraftV22 {
  const value = resetWizardDraft();
  value.serviceSelection.selectedCategories = ["ppf"];
  value.vehicle.bodySizeKey = "M";
  value.serviceConfiguration.ppf.installationMethod = "full";
  value.serviceConfiguration.ppf.fullCoverage = "front_full";
  value.serviceConfiguration.ppf.ppfTypeId = "film-x";
  value.serviceConfiguration.ppf.unitPriceInput = "999999";
  value.serviceConfiguration.ppf.vehicleCoefficientInput = "1.1";
  over?.(value);
  return value;
}

test("live PPF uses R1 front-full price and both coefficients, never the manual amount", () => {
  const result = buildWizardPricingInputFromConfig(
    draft(),
    CONFIG,
    makePricingCatalog({ ppfR1: PPF_R1 }),
    "detailer",
  );
  assert.deepEqual(result.errors, []);
  assert.equal(result.manualLines.length, 1);
  assert.equal(result.manualLines[0]?.unitPrice, 165_000);
  assert.equal(result.manualLines[0]?.label, "PPF フロントフル（PPF X）");
  assert.equal(result.manualLines[0]?.metadata.ppfBasePriceYen, 120_000);
  assert.equal(result.manualLines[0]?.metadata.ppfInstallCoefficientBp, 12_500);
  assert.equal(result.manualLines[0]?.metadata.ppfVehicleCoefficientBp, 11_000);
  assert.notEqual(result.manualLines[0]?.unitPrice, 999_999);
});

test("front-full and full-body stay independent in the live adapter", () => {
  const result = buildWizardPricingInputFromConfig(
    draft((value) => {
      value.serviceConfiguration.ppf.fullCoverage = "full_body";
      value.serviceConfiguration.ppf.vehicleCoefficientInput = "1.0";
    }),
    CONFIG,
    makePricingCatalog({ ppfR1: PPF_R1 }),
    "detailer",
  );
  assert.deepEqual(result.errors, []);
  assert.equal(result.manualLines[0]?.unitPrice, 625_000);
  assert.equal(result.manualLines[0]?.metadata.ppfBasePriceYen, 500_000);
});

test("partial PPF sums exact configured part prices before applying coefficients", () => {
  const result = buildWizardPricingInputFromConfig(
    draft((value) => {
      value.serviceConfiguration.ppf.installationMethod = "partial";
      value.serviceConfiguration.ppf.fullCoverage = null;
      value.serviceConfiguration.ppf.selectedPartIds = ["bonnet", "front-bumper"];
      value.serviceConfiguration.ppf.quantitiesByPart = { "front-bumper": 2 };
      value.serviceConfiguration.ppf.vehicleCoefficientInput = "1.0";
    }),
    CONFIG,
    makePricingCatalog({ ppfR1: PPF_R1 }),
    "detailer",
  );
  assert.deepEqual(result.errors, []);
  assert.equal(result.manualLines[0]?.metadata.ppfBasePriceYen, 140_000);
  assert.equal(result.manualLines[0]?.unitPrice, 175_000);
  assert.equal(result.manualLines[0]?.metadata.ppfPartQuantities, "bonnet:1,front-bumper:2");
});

test("missing R1 settings blocks instead of falling back to legacy tables or manual input", () => {
  const result = buildWizardPricingInputFromConfig(
    draft(),
    CONFIG,
    makePricingCatalog(),
    "detailer",
  );
  assert.ok(result.errors.some((entry) => entry.code === "PPF_R1_SETTINGS_REQUIRED"));
  assert.equal(result.manualLines.length, 0);
});

test("missing coverage, type coefficient, body-size price, and vehicle coefficient fail closed", () => {
  const catalog = makePricingCatalog({ ppfR1: PPF_R1 });
  const cases: Array<[string, EstimateWizardDraftV22, ConfiguredPricingConfiguration, string]> = [
    ["coverage", draft((v) => { v.serviceConfiguration.ppf.fullCoverage = null; }), CONFIG, "PPF_R1_COVERAGE_REQUIRED"],
    ["type", draft((v) => { v.serviceConfiguration.ppf.ppfTypeId = null; }), CONFIG, "PPF_R1_TYPE_REQUIRED"],
    ["coefficient", draft(), { ...CONFIG, installCoefficientBpByCode: {} }, "PPF_R1_COEFFICIENT_REQUIRED"],
    ["size-price", draft((v) => { v.vehicle.bodySizeKey = "XL"; }), CONFIG, "PPF_R1_PRICE_UNAVAILABLE"],
    ["vehicle", draft((v) => { v.serviceConfiguration.ppf.vehicleCoefficientInput = "0"; }), CONFIG, "PPF_R1_VEHICLE_COEFFICIENT_INVALID"],
  ];
  for (const [label, value, config, code] of cases) {
    const result = buildWizardPricingInputFromConfig(value, config, catalog, "detailer");
    assert.ok(result.errors.some((entry) => entry.code === code), label);
    assert.equal(result.manualLines.length, 0, label);
  }
});

test("PPF+coating reduction runs after R1 coefficients and snapshots the resolved values", () => {
  const result = buildWizardPricingInputFromConfig(
    draft((value) => { value.serviceConfiguration.coating.layer1Id = "pure-evo"; }),
    {
      ...CONFIG,
      ppfCoatingAdjustments: [{
        ruleId: "rule-1",
        ppfMethodCode: "full",
        coatingCode: "pure-evo",
        adjustmentType: "amount",
        adjustmentValue: 5_000,
        isActive: true,
      }],
    },
    makePricingCatalog({ ppfR1: PPF_R1 }),
    "detailer",
  );
  assert.deepEqual(result.errors, []);
  assert.equal(result.manualLines[0]?.unitPrice, 160_000);
  assert.equal(result.manualLines[0]?.metadata.ppfCoatingAdjustmentReductionYen, 5_000);
  assert.equal(result.ppfAdjustmentsByIdentity[result.manualLines[0]?.manualPricingIdentity ?? ""]?.ruleId, "rule-1");
});
