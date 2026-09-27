import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  OCR_APPLICABLE_VEHICLE_FIELDS,
  buildWizardEstimateOcrApplication,
} from "./wizard-estimate-ocr-apply-core";

test("one reviewed OCR result carries customer, vehicle and 3M recommendation together", () => {
  const applied = buildWizardEstimateOcrApplication({
    customer_candidate_name: "有限会社 オフィスアズ",
    customer_candidate_postal_code: "523-1234",
    customer_candidate_address: "滋賀県愛知郡愛荘町愛知川774-4",
    maker: "トヨタ",
    vehicle_name: "クラウン",
    grade: "RS",
    model: "6AA-AZSH20",
    model_code: "19941",
    displacement: "2487cc",
    chassis_number: "AZSH20-1234567",
    first_registration_date: "2024-05",
    registration_date: "2024-05-10",
    inspection_expiry_date: "2027-05-09",
    color: "白",
    license_plate_region: "滋賀",
    license_plate_class: "330",
    license_plate_kana: "に",
    license_plate_number: "1234",
    length_mm: 5030,
    width_mm: 1890,
    height_mm: 1475,
    dimension_confidence: 0.95,
  });

  assert.deepEqual(applied.customer, {
    name: "有限会社 オフィスアズ",
    postal: "523-1234",
    address: "滋賀県愛知郡愛荘町愛知川774-4",
  });
  assert.deepEqual(applied.vehicle, {
    maker: "トヨタ",
    model: "クラウン",
    grade: "RS",
    vehicleCode: "6AA-AZSH20",
    displacement: "2487cc",
    vin: "AZSH20-1234567",
    firstRegYearMonth: "2024-05",
    registrationDate: "2024-05-10",
    inspectionExpiry: "2027-05-09",
    color: "白",
    plateNumber: "滋賀 330 に 1234",
  });
  assert.equal(applied.bodySizeEstimate.source, "OCR");
  assert.notEqual(applied.bodySizeEstimate.sizeKey, null);
  assert.equal(applied.bodySizeEstimate.requiresManualConfirmation, true);
});

test("operator-edited vehicle_name is the vehicle name and model is the vehicle type", () => {
  const applied = buildWizardEstimateOcrApplication({
    vehicle_name: "手入力した車名",
    model: "DBA-ABC123",
    model_code: "12345",
  }, { source: "reviewed" });
  assert.equal(applied.vehicle.model, "手入力した車名");
  assert.equal(applied.vehicle.vehicleCode, "DBA-ABC123");
});

test("型式指定番号 / 類別区分番号 / 原動機の型式 never substitute for the certificate 型式", () => {
  const applied = buildWizardEstimateOcrApplication({
    model_code: "99999",
    classification_number: "9999",
    engine_model: "9ZZ-FE",
  });
  assert.equal(applied.vehicle.vehicleCode, undefined);
  assert.deepEqual(applied.vehicle, {});
});

test("blank OCR 車名/グレード leave operator-entered values intact when merged", () => {
  const operator = { model: "手入力の車名", grade: "手入力グレード", vehicleCode: "手入力型式" };
  const patch = buildWizardEstimateOcrApplication({ vehicle_name: "", grade: "", model: " " }).vehicle;
  assert.deepEqual({ ...operator, ...patch }, operator);
});

test("legacy replay: a grade equal to the engine code is dropped, a distinct operator grade is kept", () => {
  const replayed = buildWizardEstimateOcrApplication({ grade: "9ZZ-FE", engine_model: "9ZZ-FE", model: "DBA-ZZZ999" });
  assert.equal(replayed.vehicle.grade, undefined);
  assert.equal(replayed.vehicle.vehicleCode, "DBA-ZZZ999");

  const fullWidth = buildWizardEstimateOcrApplication({ grade: "９ＺＺ－ＦＥ", engine_model: "9ZZ-FE" });
  assert.equal(fullWidth.vehicle.grade, undefined);

  const operator = buildWizardEstimateOcrApplication({ grade: "手入力グレード", engine_model: "9ZZ-FE" }, { source: "reviewed" });
  assert.equal(operator.vehicle.grade, "手入力グレード");
});

test("a 型式-like value in 型式指定番号 is never recovered as 型式", () => {
  const pending = buildWizardEstimateOcrApplication({ model_code: "LZZ-ZZ9Z99" });
  assert.equal(pending.vehicle.vehicleCode, undefined);
  const confirmed = buildWizardEstimateOcrApplication({ model: "LZZ-ZZ9Z99" }, { source: "reviewed" });
  assert.equal(confirmed.vehicle.vehicleCode, "LZZ-ZZ9Z99");
});

test("reviewed manual hyphen-less 型式 survives; the same raw OCR token fails closed", () => {
  const input = { model: "Z999Z" };
  assert.equal(buildWizardEstimateOcrApplication(input).vehicle.vehicleCode, undefined);
  assert.equal(buildWizardEstimateOcrApplication(input, { source: "reviewed" }).vehicle.vehicleCode, "Z999Z");
});

test("engine-like value in 型式指定番号 never substitutes for missing 型式", () => {
  const applied = buildWizardEstimateOcrApplication({ model_code: "Z09Z", engine_model: "Z09Z" });
  assert.equal(applied.vehicle.vehicleCode, undefined);
});

test("blank OCR values do not clear operator-entered vehicle fields", () => {
  const applied = buildWizardEstimateOcrApplication({ maker: "  ", vehicle_name: "" });
  assert.deepEqual(applied.vehicle, {});
});

test("vehicle OCR patch cannot widen beyond its exact allowlist", () => {
  const applied = buildWizardEstimateOcrApplication({
    maker: "トヨタ",
    notes: "must not enter the vehicle draft",
    body_shape: "箱型",
  });
  for (const key of Object.keys(applied.vehicle)) {
    assert.ok((OCR_APPLICABLE_VEHICLE_FIELDS as readonly string[]).includes(key), key);
  }
});

test("Screen 1 and Screen 2 are wired to the same canonical OCR application", () => {
  const host = readFileSync("src/components/estimates/wizard/EstimateWizard.tsx", "utf8");
  const step1 = readFileSync("src/components/estimates/wizard/steps/Step1Customer.tsx", "utf8");
  const step2 = readFileSync("src/components/estimates/wizard/steps/Step2Vehicle.tsx", "utf8");

  assert.ok(host.includes("onSizeEstimate={setBodySizeEstimate}"));
  assert.ok(step1.includes('buildWizardEstimateOcrApplication(f, { source: "reviewed" })'));
  assert.ok(step1.includes("customer: applied.customer, vehicle: applied.vehicle"));
  assert.ok(step1.includes("onSizeEstimate?.(applied.bodySizeEstimate)"));
  assert.ok(step2.includes('buildWizardEstimateOcrApplication(f, { source: "reviewed" })'));
  assert.ok(step2.includes("onSizeEstimate?.(applied.bodySizeEstimate)"));
});

test("an operator value entered into an OCR-blank review field becomes applicable", () => {
  const review = readFileSync("src/components/vehicle-registration/VehicleRegistrationOcrReview.tsx", "utf8");
  const edit = review.slice(review.indexOf("function editField"), review.indexOf("function selectAll"));
  assert.ok(edit.includes('if (val.trim() !== "")'));
  assert.ok(edit.includes("next.add(key)"));
});
