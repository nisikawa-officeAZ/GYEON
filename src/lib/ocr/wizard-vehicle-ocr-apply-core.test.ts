// GDA_ESTIMATE_WIZARD_OCR_POSTAL_UNIFIED_R1_A — unit tests for the pure OCR → vehicle-draft core.
// No DB, no mocks, no network.
// Run: node --import tsx --test src/lib/ocr/wizard-vehicle-ocr-apply-core.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  OCR_APPLICABLE_VEHICLE_DRAFT_FIELDS,
  buildWizardVehicleOcrPatch,
} from "./wizard-vehicle-ocr-apply-core";

// ── every approved field maps correctly ─────────────────────────────────────

test("maps every approved vehicle field from its OCR source", () => {
  const patch = buildWizardVehicleOcrPatch({
    maker: "トヨタ",
    vehicle_name: "クラウン",
    grade: "RS",
    model: "ABA-XXX",
    displacement: "1998cc",
    chassis_number: "ABC-1234567",
    first_registration_date: "2020-04",
    registration_date: "2020-04-15",
    inspection_expiry_date: "2027-04-14",
    color: "白",
  });
  assert.deepEqual(patch, {
    maker: "トヨタ",
    model: "クラウン",
    vehicleCode: "ABA-XXX",
    displacement: "1998cc",
    vin: "ABC-1234567",
    firstRegYearMonth: "2020-04",
    registrationDate: "2020-04-15",
    inspectionExpiry: "2027-04-14",
    color: "白",
  });
});

// ── grade is ALWAYS manual — OCR must never emit or overwrite it ────────────

test("grade is never emitted, even when the OCR result carries a nonblank grade", () => {
  const patch = buildWizardVehicleOcrPatch({ grade: "RS", maker: "トヨタ" });
  assert.equal("grade" in patch, false, "grade must remain manual-only — OCR must never populate it");
});

test("OCR_APPLICABLE_VEHICLE_DRAFT_FIELDS excludes grade", () => {
  assert.equal(
    (OCR_APPLICABLE_VEHICLE_DRAFT_FIELDS as readonly string[]).includes("grade"),
    false,
    "grade must not be an OCR-applicable field",
  );
});

test("emits only the ten approved keys, never grade/existingId/suggestedSize/confirmedSize", () => {
  const patch = buildWizardVehicleOcrPatch({
    maker: "トヨタ",
    vehicle_name: "クラウン",
    grade: "RS",
    model: "ABA-XXX",
    displacement: "1998cc",
    chassis_number: "ABC-1234567",
    first_registration_date: "2020-04",
    registration_date: "2020-04-15",
    inspection_expiry_date: "2027-04-14",
    color: "白",
    license_plate_region: "滋賀",
    license_plate_class: "330",
    license_plate_kana: "に",
    license_plate_number: "1234",
  });
  for (const key of Object.keys(patch)) {
    assert.ok(
      (OCR_APPLICABLE_VEHICLE_DRAFT_FIELDS as readonly string[]).includes(key),
      `${key} is outside the OCR-applicable allowlist`,
    );
  }
  assert.equal("grade" in patch, false);
  assert.equal("existingId" in patch, false);
  assert.equal("suggestedSize" in patch, false);
  assert.equal("confirmedSize" in patch, false);
});

// ── plate order and blank-fragment skipping ─────────────────────────────────

test("joins all four plate fragments with one space, in official display order", () => {
  const patch = buildWizardVehicleOcrPatch({
    license_plate_region: "滋賀",
    license_plate_class: "330",
    license_plate_kana: "に",
    license_plate_number: "1234",
  });
  assert.equal(patch.plateNumber, "滋賀 330 に 1234");
});

test("skips a blank fragment rather than leaving a doubled space", () => {
  const patch = buildWizardVehicleOcrPatch({
    license_plate_region: "滋賀",
    license_plate_class: "",
    license_plate_kana: "に",
    license_plate_number: "1234",
  });
  assert.equal(patch.plateNumber, "滋賀 に 1234");
});

test("a whitespace-only plate fragment is skipped exactly like an absent one", () => {
  const withBlank = buildWizardVehicleOcrPatch({
    license_plate_region: "滋賀",
    license_plate_class: "   ",
    license_plate_number: "1234",
  });
  const withoutField = buildWizardVehicleOcrPatch({
    license_plate_region: "滋賀",
    license_plate_number: "1234",
  });
  assert.equal(withBlank.plateNumber, "滋賀 1234");
  assert.deepEqual(withBlank, withoutField);
});

test("plateNumber is omitted entirely when every fragment is blank", () => {
  const patch = buildWizardVehicleOcrPatch({
    license_plate_region: "",
    license_plate_class: "   ",
  });
  assert.equal("plateNumber" in patch, false);
});

// ── empty and whitespace-only values are omitted, never emitted as blank strings ──

test("an empty string omits the key entirely — never an empty-string value", () => {
  const patch = buildWizardVehicleOcrPatch({ maker: "", vehicle_name: "クラウン" });
  assert.equal("maker" in patch, false, "empty OCR text must not overwrite an operator-entered value");
  assert.equal(patch.model, "クラウン");
});

test("a whitespace-only string omits the key entirely", () => {
  const patch = buildWizardVehicleOcrPatch({
    maker: "   ",
    grade: "\t\n",
    vehicle_name: "クラウン",
  });
  assert.equal("maker" in patch, false);
  assert.equal("grade" in patch, false);
  assert.equal(patch.model, "クラウン");
});

test("a blank or unreadable result yields an EMPTY patch, never blank strings", () => {
  assert.deepEqual(buildWizardVehicleOcrPatch({}), {});
  assert.deepEqual(
    buildWizardVehicleOcrPatch({
      maker: "   ",
      vehicle_name: "",
      grade: "\t",
      model: "",
      displacement: "",
      chassis_number: "",
      first_registration_date: "",
      registration_date: "",
      inspection_expiry_date: "",
      color: "",
      license_plate_region: "",
      license_plate_class: "",
      license_plate_kana: "",
      license_plate_number: "",
    }),
    {},
    "whitespace-only/empty OCR output must not overwrite fields the operator already filled",
  );
});

test("a non-string value is ignored exactly like an absent field", () => {
  const patch = buildWizardVehicleOcrPatch({
    // The canonical type declares these as strings; a hostile/malformed payload could still
    // carry a non-string at runtime, and this core must not throw or coerce it.
    displacement: 1998 as unknown as string,
    vehicle_name: "クラウン",
  });
  assert.equal("displacement" in patch, false);
  assert.equal(patch.model, "クラウン");
});

// ── trims OCR whitespace but performs no other normalization ───────────────

test("trims surrounding OCR whitespace but keeps interior spacing untouched", () => {
  const patch = buildWizardVehicleOcrPatch({ maker: "  トヨタ  ", vehicle_name: " クラウン RS " });
  assert.equal(patch.maker, "トヨタ");
  assert.equal(patch.model, "クラウン RS");
});

test("performs no NFKC folding, aliasing, or fallback mapping on the applied value", () => {
  // Half-width katakana must survive verbatim: match normalization is a DIFFERENT module's
  // concern (the duplicate core), never this one's.
  const patch = buildWizardVehicleOcrPatch({ maker: "ﾄﾖﾀ" });
  assert.equal(patch.maker, "ﾄﾖﾀ", "the applied value must not be NFKC-folded here");
});

// ── operator-entered text survives a missing/blank OCR value (proven at the store level too) ──

test("a field the certificate never carried is simply absent from the patch", () => {
  const patch = buildWizardVehicleOcrPatch({ vehicle_name: "クラウン" });
  for (const key of OCR_APPLICABLE_VEHICLE_DRAFT_FIELDS) {
    if (key === "model") continue;
    assert.equal(key in patch, false, `${key} must be absent, not blank`);
  }
});
