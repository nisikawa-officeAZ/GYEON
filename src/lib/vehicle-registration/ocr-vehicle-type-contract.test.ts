// Vehicle-registration 型式 / 車名 / グレード contract.
// Run: node --import tsx --test src/lib/vehicle-registration/ocr-vehicle-type-contract.test.ts
//
// Every value below is SYNTHETIC. No customer data and no real certificate values are used.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { applyVehicleIdentityPolicy, sanitizeVehicleRegistrationOcrResult } from "./ocr";
import { buildOcrQualityReport, resolveVehicleIdentity } from "./ocr-quality";
import { applyPdfTextLayerCertificateFields, extractCertificateCodesFromLines } from "./pdf-text-layer";
import { OCR_FIELD_LABELS, OCR_TO_VEHICLE_MAP } from "./vehicle-registration-types";
import { buildWizardEstimateOcrApplication } from "@/lib/ocr/wizard-estimate-ocr-apply-core";
import { mapOcrToVehicle } from "@/lib/ocr/vehicle-mapper";

// Synthetic certificate values (deliberately impossible codes).
const CERT_TYPE   = "DBA-ZZZ999"; // 型式
const ENGINE_TYPE = "9ZZ-FE";     // 原動機の型式
const TYPE_APPROVAL = "99999";    // 型式指定番号
const CLASSIFICATION = "9999";    // 類別区分番号
const PLATE_CLASS = "300";        // ナンバープレート分類番号 (must stay distinct from 類別区分番号)

test("an engine type never becomes グレード, and 型式 stays the certificate 型式", () => {
  const result = applyVehicleIdentityPolicy(sanitizeVehicleRegistrationOcrResult({
    vehicle_name: "トヨタ",
    maker: "トヨタ",
    model: CERT_TYPE,
    engine_model: ENGINE_TYPE,
    grade: ENGINE_TYPE, // AI misclassified the engine type as a grade
  }));
  assert.equal(result.grade, undefined);
  assert.equal(result.vehicle_name, undefined);
  assert.equal(result.maker, "トヨタ");
  assert.equal(result.model, CERT_TYPE);
  assert.equal(result.engine_model, ENGINE_TYPE);
  assert.notEqual(result.model, result.engine_model);
});

test("commercial 車名 and グレード are always blank even when the AI guessed them", () => {
  const result = applyVehicleIdentityPolicy(sanitizeVehicleRegistrationOcrResult({
    vehicle_name: "トヨタ テスト車 テストグレード",
    grade: "テストグレード",
    model: CERT_TYPE,
    color: "白",
  }));
  assert.equal(result.maker, "トヨタ");
  assert.equal(result.vehicle_name, undefined);
  assert.equal(result.grade, undefined);
  assert.equal(result.color, undefined);
  assert.equal(result.model, CERT_TYPE);
});

test("an engine type, 型式指定番号, or bare number leaked into 型式 is dropped, never guessed", () => {
  const leakedEngine = applyVehicleIdentityPolicy({ model: ENGINE_TYPE, engine_model: ENGINE_TYPE });
  assert.equal(leakedEngine.model, undefined);
  assert.equal(leakedEngine.engine_model, ENGINE_TYPE);

  const leakedApproval = applyVehicleIdentityPolicy({ model: TYPE_APPROVAL, model_code: TYPE_APPROVAL });
  assert.equal(leakedApproval.model, undefined);
  assert.equal(leakedApproval.model_code, TYPE_APPROVAL);

  const bareNumber = applyVehicleIdentityPolicy({ model: "1234" });
  assert.equal(bareNumber.model, undefined);

  // Codes are canonicalized (trim / upper / full-width fold) — lossless, never reinterpreted.
  const spacedCase = applyVehicleIdentityPolicy({ model: " dba-zzz999 ", engine_model: "9zz-fe" });
  assert.equal(spacedCase.model, "DBA-ZZZ999");
  assert.equal(spacedCase.engine_model, "9ZZ-FE");
});

// ─── Two reported failures (synthetic kei / ordinary values) ─────────────────

const KEI_TYPE   = "DBA-ZZ9Z";   // synthetic kei certificate 型式
const KEI_ENGINE = "Z09Z";       // synthetic kei 原動機の型式 (short, hyphen-less)
const ORD_TYPE   = "LZZ-ZZ9Z99"; // synthetic ordinary-car 型式 (letters + hyphen + digits)

test("kei: an engine type in グレード/型式 never survives, while an explicitly extracted 型式 is retained", () => {
  const withType = applyVehicleIdentityPolicy(sanitizeVehicleRegistrationOcrResult({
    vehicle_name: "ホンダ", maker: "ホンダ",
    model: KEI_TYPE, engine_model: KEI_ENGINE, grade: KEI_ENGINE, model_code: TYPE_APPROVAL,
  }));
  assert.equal(withType.grade, undefined);
  assert.equal(withType.model, KEI_TYPE);
  assert.equal(withType.engine_model, KEI_ENGINE);
  assert.equal(withType.model_code, TYPE_APPROVAL);
  assert.equal(withType.model_needs_confirmation, undefined);

  // Missing 型式 stays blank — never inferred from the engine code, and the operator is told why.
  const leaked = applyVehicleIdentityPolicy(sanitizeVehicleRegistrationOcrResult({
    maker: "ホンダ", model: KEI_ENGINE, engine_model: KEI_ENGINE, grade: KEI_ENGINE,
  }));
  assert.equal(leaked.model, undefined);
  assert.equal(leaked.grade, undefined);
  assert.equal(leaked.engine_model, KEI_ENGINE);
  assert.ok((leaked.vehicle_identity_notices ?? []).some((n) => n.includes(KEI_ENGINE)));

  const onlyEngine = applyVehicleIdentityPolicy(sanitizeVehicleRegistrationOcrResult({
    maker: "ホンダ", engine_model: KEI_ENGINE,
  }));
  assert.equal(onlyEngine.model, undefined);
  assert.equal(buildWizardEstimateOcrApplication(onlyEngine).vehicle.vehicleCode, undefined);
  assert.equal(buildWizardEstimateOcrApplication(onlyEngine).vehicle.grade, undefined);
});

test("ordinary: the certificate 型式 is never displayed as 型式指定番号; 類別区分番号 stays distinct from the plate 分類番号", () => {
  // 型式 present AND duplicated into 型式指定番号 → 型式指定番号 blank, 型式 unchanged, no fabrication.
  const duplicated = applyVehicleIdentityPolicy(sanitizeVehicleRegistrationOcrResult({
    maker: "日産", model: ORD_TYPE, model_code: ORD_TYPE, license_plate_class: PLATE_CLASS,
  }));
  assert.equal(duplicated.model, ORD_TYPE);
  assert.equal(duplicated.model_code, undefined);
  assert.equal(duplicated.classification_number, undefined);
  assert.equal(duplicated.license_plate_class, PLATE_CLASS);
  assert.equal(duplicated.model_needs_confirmation, undefined);

  // 型式 blank, 型式指定番号 holds a 型式-shaped value → no cross-column recovery.
  const misplaced = applyVehicleIdentityPolicy(sanitizeVehicleRegistrationOcrResult({
    maker: "日産", model_code: ORD_TYPE, classification_number: CLASSIFICATION, license_plate_class: PLATE_CLASS,
  }));
  assert.equal(misplaced.model, undefined);
  assert.equal(misplaced.model_code, undefined);
  assert.equal(misplaced.model_needs_confirmation, undefined);
  assert.equal(misplaced.classification_number, CLASSIFICATION);
  assert.equal(misplaced.license_plate_class, PLATE_CLASS);
  assert.notEqual(misplaced.classification_number, misplaced.license_plate_class);
  assert.equal(buildWizardEstimateOcrApplication(misplaced).vehicle.vehicleCode, undefined);
  // The operator must enter the certificate's 型式 explicitly in the review.
  assert.equal(buildWizardEstimateOcrApplication({ model: ORD_TYPE }, { source: "reviewed" }).vehicle.vehicleCode, ORD_TYPE);
  const report = buildOcrQualityReport(misplaced, { model: "m", promptVersion: "p", processingMs: 1 });
  assert.equal(report.needsManualCorrection, true);
  assert.ok(report.warnings.some((w) => w.includes(ORD_TYPE)));

  // Bare digits in 型式指定番号 are a 型式指定番号 — never promoted to 型式. An engine-like value
  // (letters-only suffix) is not an unmistakable 型式 → dropped, not recovered.
  const digits = applyVehicleIdentityPolicy({ model_code: TYPE_APPROVAL });
  assert.equal(digits.model, undefined);
  assert.equal(digits.model_code, TYPE_APPROVAL);
  const engineInApproval = applyVehicleIdentityPolicy({ model_code: ENGINE_TYPE });
  assert.equal(engineInApproval.model, undefined);
  assert.equal(engineInApproval.model_code, undefined);
  assert.ok((engineInApproval.vehicle_identity_notices ?? []).some((n) => n.includes(ENGINE_TYPE)));

  // A non-numeric 類別区分番号 is dropped; an absent one is never fabricated.
  const badClass = applyVehicleIdentityPolicy({ model: ORD_TYPE, classification_number: "ZZ-1" });
  assert.equal(badClass.classification_number, undefined);
});

test("full-width code variants fold to the same canonical codes", () => {
  const r = applyVehicleIdentityPolicy(sanitizeVehicleRegistrationOcrResult({
    model: "ＬＺＺ－ＺＺ９Ｚ９９", engine_model: "Ｚ０９Ｚ", model_code: "９９９９９", classification_number: "９９９９",
  }));
  assert.equal(r.model, ORD_TYPE);
  assert.equal(r.engine_model, KEI_ENGINE);
  assert.equal(r.model_code, TYPE_APPROVAL);
  assert.equal(r.classification_number, CLASSIFICATION);

  // Full-width 型式 leaked into 型式指定番号 is excluded, never moved to 型式.
  const fw = resolveVehicleIdentity({ model_code: "ＬＺＺ－ＺＺ９Ｚ９９" }, { ambiguousGrade: "blank" });
  assert.equal(fw.result.model, undefined);
  assert.equal(fw.result.model_code, undefined);
  assert.ok(fw.notices.some((notice) => notice.includes(ORD_TYPE)));

  // Full-width grade equal to the engine code is dropped in every mode.
  const fwGrade = resolveVehicleIdentity({ grade: "Ｚ０９Ｚ", engine_model: KEI_ENGINE }, { ambiguousGrade: "keep" });
  assert.equal(fwGrade.result.grade, undefined);
});

test("legacy replay: an old グレード holding an engine code is blanked in review, but an operator grade distinct from the engine code is preserved", () => {
  // Review seeding ("blank"): equal-to-code and code-LIKE legacy grades are blanked with a notice.
  const legacyEqual = resolveVehicleIdentity({ grade: KEI_ENGINE, engine_model: KEI_ENGINE, model: KEI_TYPE }, { ambiguousGrade: "blank" });
  assert.equal(legacyEqual.result.grade, undefined);
  assert.equal(legacyEqual.result.model, KEI_TYPE);
  const legacyNoEngine = resolveVehicleIdentity({ grade: KEI_ENGINE }, { ambiguousGrade: "blank" }); // old prompt: no engine_model
  assert.equal(legacyNoEngine.result.grade, undefined);
  assert.ok(legacyNoEngine.notices.some((n) => n.includes(KEI_ENGINE)));
  const legacyText = resolveVehicleIdentity({ grade: "カスタム RS", engine_model: KEI_ENGINE }, { ambiguousGrade: "blank" });
  assert.equal(legacyText.result.grade, "カスタム RS");

  // Apply ("keep"): only equality drops a grade — operator-entered grades survive, even code-like ones.
  const applied = buildWizardEstimateOcrApplication({ grade: "手入力 RS", engine_model: KEI_ENGINE, model: KEI_TYPE }, { source: "reviewed" });
  assert.equal(applied.vehicle.grade, "手入力 RS");
  assert.equal(applied.vehicle.vehicleCode, KEI_TYPE);
  const codeLike = buildWizardEstimateOcrApplication({ grade: "15S", engine_model: KEI_ENGINE }, { source: "reviewed" });
  assert.equal(codeLike.vehicle.grade, "15S");
  const replayed = buildWizardEstimateOcrApplication({ grade: KEI_ENGINE, engine_model: KEI_ENGINE });
  assert.equal(replayed.vehicle.grade, undefined);

  // Resolution is idempotent (server output re-resolved by the review yields the same result).
  const once = resolveVehicleIdentity({ model_code: ORD_TYPE, grade: KEI_ENGINE, engine_model: KEI_ENGINE }, { ambiguousGrade: "blank" });
  const twice = resolveVehicleIdentity(once.result, { ambiguousGrade: "blank" });
  assert.deepEqual(twice.result, once.result);
});

test("onboarding mapper: leaked 型式 never lands in 型式指定番号 (and the form has no 型式 field)", () => {
  const mapped = mapOcrToVehicle({ model_code: ORD_TYPE, grade: KEI_ENGINE, engine_model: KEI_ENGINE, maker: "日産" });
  assert.equal(mapped.model_code, undefined);
  assert.equal(mapped.grade, undefined);
  assert.equal(mapped.maker, "日産");
  assert.ok(!("vehicle_code" in mapped));
});

test("the review seeds from the resolved result, never pre-fills 型式 from another column, and shows notices", () => {
  const source = readFileSync("src/components/vehicle-registration/VehicleRegistrationOcrReview.tsx", "utf8");
  assert.ok(source.includes('resolveVehicleIdentity(rawOcrResult, { ambiguousGrade: "blank" })'));
  assert.ok(!source.includes("identity.modelNeedsConfirmation"));
  assert.ok(source.includes("identity.notices.map((notice)"));
  assert.ok(source.includes("車検証と照合して必要なら手入力してください"));
  // The operator's edits go through editField untouched (no re-filtering at apply time).
  const apply = source.slice(source.indexOf("function handleApply"), source.indexOf("const hasAnyValues"));
  assert.ok(!apply.includes("resolveVehicleIdentity"));
});

test("legacy recovered 型式 is discarded and requires explicit operator entry", () => {
  const legacy = resolveVehicleIdentity({
    model: ORD_TYPE,
    model_needs_confirmation: "true",
  }, { ambiguousGrade: "blank" });
  assert.equal(legacy.result.model, undefined);
  assert.equal(legacy.result.model_needs_confirmation, undefined);
  assert.equal(buildWizardEstimateOcrApplication(legacy.result).vehicle.vehicleCode, undefined);
  assert.ok(legacy.notices.some((notice) => notice.includes("手入力")));
});

test("the same short engine-like code in 型式指定番号 never overwrites a distinct certificate 型式", () => {
  const result = applyVehicleIdentityPolicy({ model: KEI_TYPE, model_code: KEI_ENGINE, engine_model: KEI_ENGINE });
  assert.equal(result.model, KEI_TYPE);
  assert.equal(result.model_code, undefined);
  assert.equal(result.engine_model, KEI_ENGINE);
});

test("型式指定番号 and 類別区分番号 are separate from each other and from the plate 分類番号", () => {
  const result = applyVehicleIdentityPolicy(sanitizeVehicleRegistrationOcrResult({
    model: CERT_TYPE,
    model_code: TYPE_APPROVAL,
    classification_number: CLASSIFICATION,
    license_plate_class: PLATE_CLASS,
  }));
  assert.equal(result.model_code, TYPE_APPROVAL);
  assert.equal(result.classification_number, CLASSIFICATION);
  assert.equal(result.license_plate_class, PLATE_CLASS);
  assert.equal(OCR_FIELD_LABELS.classification_number, "類別区分番号");
  assert.equal(OCR_FIELD_LABELS.engine_model, "原動機の型式");
  assert.equal(OCR_FIELD_LABELS.model, "型式");
  assert.equal(OCR_TO_VEHICLE_MAP.model, "vehicle_code");
});

test("the certificate 型式 maps to the estimate vehicleCode; nothing else substitutes", () => {
  const result = applyVehicleIdentityPolicy(sanitizeVehicleRegistrationOcrResult({
    maker: "トヨタ",
    vehicle_name: "トヨタ",
    model: CERT_TYPE,
    engine_model: ENGINE_TYPE,
    model_code: TYPE_APPROVAL,
    classification_number: CLASSIFICATION,
    grade: ENGINE_TYPE,
  }));
  const applied = buildWizardEstimateOcrApplication(result);
  assert.equal(applied.vehicle.vehicleCode, CERT_TYPE);
  assert.equal(applied.vehicle.model, undefined);
  assert.equal(applied.vehicle.grade, undefined);
  assert.equal(applied.vehicle.maker, "トヨタ");
  assert.ok(!("classification_number" in applied.vehicle));
  assert.ok(!("engine_model" in applied.vehicle));

  const withoutType = buildWizardEstimateOcrApplication(applyVehicleIdentityPolicy({
    model_code: TYPE_APPROVAL,
    engine_model: ENGINE_TYPE,
    classification_number: CLASSIFICATION,
  }));
  assert.equal(withoutType.vehicle.vehicleCode, undefined);
});

test("blank OCR 車名/グレード/型式 never clear operator-entered estimate values", () => {
  const operator = { maker: "手入力メーカー", model: "手入力の車名", grade: "手入力グレード", vehicleCode: "手入力型式" };

  const blank = buildWizardEstimateOcrApplication(applyVehicleIdentityPolicy({ vehicle_name: "", grade: "", model: "" })).vehicle;
  assert.deepEqual({ ...operator, ...blank }, operator);

  const withType = buildWizardEstimateOcrApplication(applyVehicleIdentityPolicy({ model: CERT_TYPE })).vehicle;
  assert.deepEqual({ ...operator, ...withType }, { ...operator, vehicleCode: CERT_TYPE });
});

test("the quality report treats 車名 as manual input, not as a missing OCR field", () => {
  const report = buildOcrQualityReport({
    maker: "トヨタ",
    model: CERT_TYPE,
    first_registration_date: "2020-01",
    registration_date: "2020-01-15",
    inspection_expiry_date: "2027-01-14",
    license_plate_number: "9999",
    chassis_number: "ZZZ999-0000001",
    displacement: "1999cc",
  }, { model: "test-model", promptVersion: "test", processingMs: 1 });
  assert.deepEqual(report.missingRequired, []);
  assert.ok(report.manualRequired.includes("車名"));
  assert.ok(report.manualRequired.includes("ボディカラー"));
  assert.equal(report.needsManualCorrection, false);
});

test("the onboarding mapper no longer invents 車名 from the certificate 型式", () => {
  const mapped = mapOcrToVehicle({ model: CERT_TYPE, model_code: TYPE_APPROVAL });
  assert.equal(mapped.model, undefined);
  assert.equal(mapped.model_code, TYPE_APPROVAL);
});

test("the extraction prompt names 型式 / 原動機の型式 / 類別区分番号 and no longer asks for グレード", () => {
  const source = readFileSync("src/lib/vehicle-registration/ocr.ts", "utf8");
  const schema = source.slice(source.indexOf("出力JSONスキーマ"), source.indexOf("// ─── Typed error codes"));
  assert.ok(schema.includes('"model": ""'));
  assert.ok(schema.includes('"engine_model": ""'));
  assert.ok(schema.includes('"model_code": ""'));
  assert.ok(schema.includes('"classification_number": ""'));
  assert.ok(!schema.includes('"grade": ""'));
  assert.ok(source.includes("原動機の型式"));
  assert.ok(source.includes("類別区分番号"));
});

test("OCR review vehicle section leads with the owner order and keeps the rest in prior order", () => {
  const source = readFileSync("src/components/vehicle-registration/VehicleRegistrationOcrReview.tsx", "utf8");
  const match = /const VEHICLE_FIELDS: ReviewField\[\] = \[([\s\S]*?)\];/.exec(source);
  assert.ok(match, "VEHICLE_FIELDS array not found");
  const fields = [...match[1].matchAll(/"([a-z_]+)"/g)].map((m) => m[1]);
  assert.deepEqual(fields, [
    "maker", "vehicle_name", "grade", "color", "model", "chassis_number", "model_code", "classification_number",
    "license_plate_region", "license_plate_class", "license_plate_kana", "license_plate_number",
    "first_registration_date", "registration_date", "inspection_expiry_date",
    "displacement", "fuel_type", "length_mm", "width_mm", "height_mm",
  ]);
  assert.ok(!fields.includes("engine_model"), "原動機の型式 is captured but not offered for apply");
});

function fieldLabels(source: string, from: string, to: string): string[] {
  const start = source.indexOf(from);
  const end = source.indexOf(to, start);
  assert.ok(start >= 0 && end > start, `section ${from} … ${to} not found`);
  return [...source.slice(start, end).matchAll(/<Field label="([^"]+)"/g)].map((m) => m[1]);
}

test("estimate Step 2 vehicle forms follow the leading order where those fields exist", () => {
  const screens = readFileSync("src/components/estimates/wizard/screens/Step2Vehicle.tsx", "utf8");
  assert.deepEqual(fieldLabels(screens, 'vehicleMode === "new"', "ボディサイズ（3M推定は推奨のみ）"), [
    "メーカー", "車名", "グレード", "ボディカラー", "型式", "車体番号",
    "ナンバープレート", "初年度登録年月", "登録年月日", "車検満了年月日",
  ]);

  const steps = readFileSync("src/components/estimates/wizard/steps/Step2Vehicle.tsx", "utf8");
  assert.deepEqual(fieldLabels(steps, "<ChoiceGrid cols={2}>", "</ChoiceGrid>"), [
    "メーカー", "車名", "型式", "排気量", "ナンバープレート",
  ]);
});

// ─── Selectable PDF text layer (synthetic codes: 型式 6BA-ABC1 / 原動機の型式 XYZ1 / 型式指定番号 12345 / 類別区分番号 0007) ───

const PDF_TYPE = "6BA-ABC1";
const PDF_ENGINE = "XYZ1";
const PDF_APPROVAL = "12345";
const PDF_CLASS = "0007";
const PDF_LINES = [`型式 ${PDF_TYPE} 原動機の型式 ${PDF_ENGINE}`, `型式指定番号 ${PDF_APPROVAL} 類別区分番号 ${PDF_CLASS}`];

test("kei selectable PDF: the text-layer 型式 is restored and the engine code leaves グレード/型式指定番号; 車名・グレード stay blank", () => {
  const sanitized = sanitizeVehicleRegistrationOcrResult({
    vehicle_name: "ホンダ", maker: "ホンダ", grade: PDF_ENGINE, model_code: PDF_ENGINE, engine_model: PDF_ENGINE,
    owner_name: "合成 名義", license_plate_class: PLATE_CLASS,
  });
  const layer = applyPdfTextLayerCertificateFields(sanitized, extractCertificateCodesFromLines(PDF_LINES));
  const result = applyVehicleIdentityPolicy(sanitized, { trustedModelShape: layer.trustedModel });
  assert.equal(result.model, PDF_TYPE);
  assert.equal(result.engine_model, PDF_ENGINE);
  assert.equal(result.model_code, PDF_APPROVAL);
  assert.equal(result.classification_number, PDF_CLASS);
  assert.equal(result.grade, undefined);
  assert.equal(result.vehicle_name, undefined);
  assert.equal(result.owner_name, "合成 名義");
  assert.equal(result.license_plate_class, PLATE_CLASS);
  assert.ok((result.vehicle_identity_notices ?? []).some((n) => n.includes("PDFの文字情報から")));

  const applied = buildWizardEstimateOcrApplication(result);
  assert.equal(applied.vehicle.vehicleCode, PDF_TYPE);
  assert.equal(applied.vehicle.grade, undefined);
  assert.equal(applied.vehicle.model, undefined);
  const report = buildOcrQualityReport(result, { model: "m", promptVersion: "p", processingMs: 1 });
  assert.ok(!report.missingRequired.includes("型式"));
});

test("ordinary selectable PDF: 類別区分番号 keeps its leading zero and is never confused with the plate 分類番号", () => {
  const sanitized = sanitizeVehicleRegistrationOcrResult({ maker: "日産", model: PDF_TYPE, license_plate_class: PLATE_CLASS });
  applyPdfTextLayerCertificateFields(sanitized, extractCertificateCodesFromLines([`型式指定番号 ${PDF_APPROVAL} 類別区分番号 ${PDF_CLASS}`]));
  const result = applyVehicleIdentityPolicy(sanitized);
  assert.equal(result.classification_number, "0007");
  assert.equal(result.model_code, PDF_APPROVAL);
  assert.equal(result.license_plate_class, PLATE_CLASS);
  assert.equal(result.model, PDF_TYPE);
});

test("a trusted text-layer 型式 bypasses only the hyphen-less shape rule; every other safeguard still applies", () => {
  const trusted = { ambiguousGrade: "blank" as const, trustedModelShape: true };
  const untrusted = { ambiguousGrade: "blank" as const };
  assert.equal(resolveVehicleIdentity({ model: "XYZ9", engine_model: PDF_ENGINE }, trusted).result.model, "XYZ9");
  assert.equal(resolveVehicleIdentity({ model: "XYZ9", engine_model: PDF_ENGINE }, untrusted).result.model, undefined);
  assert.equal(applyVehicleIdentityPolicy({ model: "XYZ9", engine_model: PDF_ENGINE }).model, undefined); // AI output: never trusted
  assert.equal(resolveVehicleIdentity({ model: PDF_ENGINE, engine_model: PDF_ENGINE }, trusted).result.model, undefined); // equal to engine
  assert.equal(resolveVehicleIdentity({ model: PDF_APPROVAL }, trusted).result.model, undefined);                          // digits only
  assert.equal(resolveVehicleIdentity({ model: PDF_TYPE, model_needs_confirmation: "true" }, trusted).result.model, undefined);
  // No text-layer 型式 → nothing is trusted, even when other codes were applied.
  const partial = applyPdfTextLayerCertificateFields({ model: "XYZ9" }, extractCertificateCodesFromLines([`類別区分番号 ${PDF_CLASS}`]));
  assert.equal(partial.trustedModel, false);
});

test("F1: a legacy model_needs_confirmation flag never deletes a 型式 applied from the PDF text layer (full override → policy)", () => {
  // Legacy/replayed result: 型式 held a value moved from another column (flag set), 車名・グレード blank.
  const sanitized = sanitizeVehicleRegistrationOcrResult({
    maker: "ホンダ", vehicle_name: "", grade: "", model: PDF_ENGINE, engine_model: PDF_ENGINE, model_code: PDF_ENGINE,
    owner_name: "合成 名義", license_plate_class: PLATE_CLASS,
  });
  sanitized.model_needs_confirmation = "true";
  const layer = applyPdfTextLayerCertificateFields(sanitized, extractCertificateCodesFromLines(PDF_LINES));
  assert.equal(layer.trustedModel, true);
  assert.equal(sanitized.model_needs_confirmation, undefined);

  const result = applyVehicleIdentityPolicy(sanitized, { trustedModelShape: layer.trustedModel });
  assert.equal(result.model, PDF_TYPE);                       // the trusted PDF 型式 survives
  assert.equal(result.model_needs_confirmation, undefined);
  assert.equal(result.engine_model, PDF_ENGINE);
  assert.equal(result.model_code, PDF_APPROVAL);
  assert.equal(result.classification_number, PDF_CLASS);
  assert.equal(result.grade, undefined);
  assert.equal(result.vehicle_name, undefined);
  assert.equal(result.maker, "ホンダ");
  assert.equal(result.owner_name, "合成 名義");
  assert.equal(result.license_plate_class, PLATE_CLASS);
  const notices = result.vehicle_identity_notices ?? [];
  assert.ok(!notices.some((n) => n.includes("退避した型式は除外")), notices.join(" | "));
  assert.ok(notices.some((n) => n.includes("確認フラグ") && n.includes("解除")));
  assert.equal(buildWizardEstimateOcrApplication(result).vehicle.vehicleCode, PDF_TYPE);

  // Fail-closed is preserved: no PDF 型式 applied (other codes only) → the flagged legacy 型式 is still dropped.
  const partial = sanitizeVehicleRegistrationOcrResult({ maker: "ホンダ", model: CERT_TYPE, engine_model: PDF_ENGINE });
  partial.model_needs_confirmation = "true";
  const partialLayer = applyPdfTextLayerCertificateFields(partial, extractCertificateCodesFromLines([`類別区分番号 ${PDF_CLASS}`]));
  assert.equal(partialLayer.trustedModel, false);
  assert.equal(partial.model_needs_confirmation, "true");
  const partialResult = applyVehicleIdentityPolicy(partial, { trustedModelShape: partialLayer.trustedModel });
  assert.equal(partialResult.model, undefined);
  assert.equal(partialResult.classification_number, PDF_CLASS);
  assert.ok((partialResult.vehicle_identity_notices ?? []).some((n) => n.includes("退避した型式は除外")));

  // No text layer at all (scanned PDF / image) → unchanged legacy behaviour.
  const scanned = sanitizeVehicleRegistrationOcrResult({ maker: "ホンダ", model: CERT_TYPE });
  scanned.model_needs_confirmation = "true";
  applyPdfTextLayerCertificateFields(scanned, { status: "no_text", fields: {}, notices: [], lineCount: 0 });
  assert.equal(applyVehicleIdentityPolicy(scanned).model, undefined);

  // The other trusted-model safeguards are untouched: equal-to-engine and digits-only PDF values still fall.
  const equal = sanitizeVehicleRegistrationOcrResult({ engine_model: "XYZ9" });
  equal.model_needs_confirmation = "true";
  const equalLayer = applyPdfTextLayerCertificateFields(equal, extractCertificateCodesFromLines(["型式 XYZ9"]));
  assert.equal(equalLayer.trustedModel, true);
  assert.equal(applyVehicleIdentityPolicy(equal, { trustedModelShape: true }).model, undefined);
});

test("ocr.ts runs the PDF text layer only for PDFs, after sanitizing and before the identity policy, and logs field names only", () => {
  const source = readFileSync("src/lib/vehicle-registration/ocr.ts", "utf8");
  assert.ok(source.includes('if (mimeType === "application/pdf") {'));
  assert.ok(source.includes("extractCertificateCodesFromPdfBase64(imageBase64)"));
  const sanitizeAt = source.indexOf("sanitizeVehicleRegistrationOcrResult(parsed)");
  const overrideAt = source.indexOf("applyPdfTextLayerCertificateFields(sanitized, pdfTextLayer)");
  const policyAt = source.indexOf("applyVehicleIdentityPolicy(sanitized, { trustedModelShape: textLayer.trustedModel })");
  assert.ok(sanitizeAt > 0 && overrideAt > sanitizeAt && policyAt > overrideAt);
  assert.ok(source.includes("Object.keys(pdfTextLayer.fields).join"));
  assert.ok(!source.includes("JSON.stringify(pdfTextLayer"));
});
