// Vehicle-registration 型式 / 車名 / グレード contract.
// Run: node --import tsx --test src/lib/vehicle-registration/ocr-vehicle-type-contract.test.ts
//
// Every value below is SYNTHETIC. No customer data and no real certificate values are used.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { applyVehicleIdentityPolicy, sanitizeVehicleRegistrationOcrResult } from "./ocr";
import { buildOcrQualityReport, resolveVehicleIdentity } from "./ocr-quality";
import { applyPdfTextLayerCertificateFields, extractCertificateCodesFromItems, extractCertificateCodesFromLines, type PdfTextItemLike } from "./pdf-text-layer";
import { OCR_FIELD_LABELS, OCR_TO_VEHICLE_MAP, type VehicleRegistrationOcrResult } from "./vehicle-registration-types";
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
  applyPdfTextLayerCertificateFields(scanned, { status: "no_text", fields: {}, rejected: {}, notices: [], lineCount: 0 });
  assert.equal(applyVehicleIdentityPolicy(scanned).model, undefined);

  // The other trusted-model safeguards are untouched: equal-to-engine and digits-only PDF values still fall.
  const equal = sanitizeVehicleRegistrationOcrResult({ engine_model: "XYZ9" });
  equal.model_needs_confirmation = "true";
  const equalLayer = applyPdfTextLayerCertificateFields(equal, extractCertificateCodesFromLines(["型式 XYZ9"]));
  assert.equal(equalLayer.trustedModel, true);
  assert.equal(applyVehicleIdentityPolicy(equal, { trustedModelShape: true }).model, undefined);
});

test("R2: a 型式 whose PDF evidence carries a 改 mark is neither taken from the PDF nor kept from the AI; the report flags manual entry and the other codes stay", () => {
  const ctx = { model: "m", promptVersion: "p", processingMs: 1 };
  const sanitized = sanitizeVehicleRegistrationOcrResult({
    vehicle_name: "ホンダ", maker: "ホンダ", model: PDF_TYPE, grade: PDF_ENGINE, engine_model: PDF_ENGINE, model_code: PDF_ENGINE,
    owner_name: "合成 名義", license_plate_class: PLATE_CLASS,
  });
  const layer = applyPdfTextLayerCertificateFields(sanitized, extractCertificateCodesFromLines([
    `型式 ${PDF_TYPE} 改 原動機の型式 ${PDF_ENGINE}`, `型式指定番号 ${PDF_APPROVAL} 類別区分番号 ${PDF_CLASS}`,
  ]));
  assert.deepEqual(layer, { applied: ["engine_model", "model_code", "classification_number"], trustedModel: false, manualEntry: ["model"] });
  const result = applyVehicleIdentityPolicy(sanitized, { trustedModelShape: layer.trustedModel });
  assert.equal(result.model, undefined);                 // never the bare prefix — the certificate prints "6BA-ABC1 改"
  assert.equal(result.engine_model, PDF_ENGINE);
  assert.equal(result.model_code, PDF_APPROVAL);
  assert.equal(result.classification_number, PDF_CLASS);
  assert.equal(result.grade, undefined);
  assert.equal(result.vehicle_name, undefined);
  assert.equal(result.maker, "ホンダ");
  assert.equal(result.owner_name, "合成 名義");
  assert.equal(result.license_plate_class, PLATE_CLASS);
  assert.equal(buildWizardEstimateOcrApplication(result).vehicle.vehicleCode, undefined);

  const report = buildOcrQualityReport(result, ctx);
  assert.equal(report.needsManualCorrection, true);
  assert.deepEqual(report.manualEntryRequired, ["型式"]);
  assert.ok(report.missingRequired.includes("型式"));
  assert.ok(report.warnings.some((w) => w.startsWith("【要手入力：型式】") && w.includes(`${PDF_TYPE} 改`)), report.warnings.join(" | "));
  const aiWarning = report.warnings.find((w) => w.includes("AI読み取りの型式"));
  assert.ok(aiWarning !== undefined && aiWarning.includes("表示しません") && aiWarning.includes("手入力"), report.warnings.join(" | "));
  assert.ok(!aiWarning.includes(PDF_TYPE), aiWarning); // the withheld AI candidate is never echoed

  // The manual-entry state survives the review's re-resolution (idempotent notices).
  const again = resolveVehicleIdentity(result, { ambiguousGrade: "blank" });
  assert.deepEqual(again.result, result);
  assert.deepEqual(buildOcrQualityReport(again.result, ctx).manualEntryRequired, ["型式"]);

  // Regression: an AI 型式 distinguishable from the rejected PDF text is withheld and appears in NO notice or
  // report warning; the manual-entry warning still quotes the PDF evidence itself.
  const distinct = sanitizeVehicleRegistrationOcrResult({ maker: "ホンダ", model: CERT_TYPE, engine_model: PDF_ENGINE, license_plate_class: PLATE_CLASS });
  const distinctLayer = applyPdfTextLayerCertificateFields(distinct, extractCertificateCodesFromLines([`型式 ${PDF_TYPE} 改 原動機の型式 ${PDF_ENGINE}`]));
  assert.deepEqual(distinctLayer.manualEntry, ["model"]);
  const distinctResult = applyVehicleIdentityPolicy(distinct, { trustedModelShape: distinctLayer.trustedModel });
  assert.equal(distinctResult.model, undefined);
  assert.equal(distinctResult.engine_model, PDF_ENGINE);
  const distinctNotices = distinctResult.vehicle_identity_notices ?? [];
  assert.ok(distinctNotices.some((n) => n.includes("AI読み取りの型式") && n.includes("表示しません")), distinctNotices.join(" | "));
  assert.ok(distinctNotices.every((n) => !n.includes(CERT_TYPE)), distinctNotices.join(" | "));
  const distinctReport = buildOcrQualityReport(distinctResult, ctx);
  assert.deepEqual(distinctReport.manualEntryRequired, ["型式"]);
  assert.ok(distinctReport.warnings.some((w) => w.startsWith("【要手入力：型式】") && w.includes(`${PDF_TYPE} 改`)), distinctReport.warnings.join(" | "));
  assert.ok(distinctReport.warnings.every((w) => !w.includes(CERT_TYPE)), distinctReport.warnings.join(" | "));

  // A rejected NON-required code (類別区分番号) also flags manual entry; the AI 型式 (absent from the PDF) is kept.
  const optional = sanitizeVehicleRegistrationOcrResult({ maker: "日産", model: PDF_TYPE, classification_number: PDF_CLASS, license_plate_class: PLATE_CLASS });
  const optionalLayer = applyPdfTextLayerCertificateFields(optional, extractCertificateCodesFromLines([`型式指定番号 ${PDF_APPROVAL} 類別区分番号 ${PDF_CLASS} 改`]));
  assert.deepEqual(optionalLayer.manualEntry, ["classification_number"]);
  const optionalResult = applyVehicleIdentityPolicy(optional, { trustedModelShape: optionalLayer.trustedModel });
  assert.equal(optionalResult.model, PDF_TYPE);
  assert.equal(optionalResult.model_code, PDF_APPROVAL);
  assert.equal(optionalResult.classification_number, undefined);
  assert.equal(optionalResult.license_plate_class, PLATE_CLASS);
  const optionalReport = buildOcrQualityReport(optionalResult, ctx);
  assert.equal(optionalReport.needsManualCorrection, true);
  assert.deepEqual(optionalReport.manualEntryRequired, ["類別区分番号"]);

  // Scanned PDF / image (no text layer): the AI 型式 remains the fallback and the text layer flags nothing.
  const scanned = sanitizeVehicleRegistrationOcrResult({ maker: "ホンダ", model: PDF_TYPE, engine_model: PDF_ENGINE });
  const scannedLayer = applyPdfTextLayerCertificateFields(scanned, { status: "no_text", fields: {}, rejected: {}, notices: [], lineCount: 0 });
  assert.deepEqual(scannedLayer.manualEntry, []);
  const scannedResult = applyVehicleIdentityPolicy(scanned, { trustedModelShape: scannedLayer.trustedModel });
  assert.equal(scannedResult.model, PDF_TYPE);
  assert.deepEqual(buildOcrQualityReport(scannedResult, ctx).manualEntryRequired, []);
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

// ─── R2 two-finding repair: 「旧型式」 is not a label; a text-layer 型式 keeps its provenance through the review ───

const REMARK_OLD_TYPE = "6BA-OLD999"; // synthetic value quoted in a remark (「旧型式 …」) — never a certificate 型式 here
const TL_TYPE   = "XYZ9";             // synthetic hyphen-less (kei-like) certificate 型式 verified from the text layer
const TL_ENGINE = "ABC1";             // synthetic 原動機の型式
const CTX = { model: "m", promptVersion: "p", processingMs: 1 };

test("R2-3 (pipeline, T1 re-baseline): 「備考: 旧型式 6BA-OLD999」 never becomes the accepted 型式 — it is old-model evidence, so 型式 is withheld for manual entry (server, review, report, estimate)", () => {
  const extraction = extractCertificateCodesFromLines([`原動機の型式 ${TL_ENGINE}`, `備考: 旧型式 ${REMARK_OLD_TYPE}`]);
  assert.deepEqual(extraction.fields, { engine_model: TL_ENGINE });
  assert.deepEqual(Object.keys(extraction.rejected), ["model"]);
  assert.ok(extraction.rejected.model !== undefined && extraction.rejected.model.startsWith("【要手入力：型式】") && extraction.rejected.model.includes("旧型式"), extraction.rejected.model);
  const sanitized = sanitizeVehicleRegistrationOcrResult({ maker: "ホンダ", engine_model: TL_ENGINE, grade: TL_ENGINE, owner_name: "合成 名義" });
  const layer = applyPdfTextLayerCertificateFields(sanitized, extraction);
  assert.deepEqual(layer, { applied: ["engine_model"], trustedModel: false, manualEntry: ["model"] });
  const result = applyVehicleIdentityPolicy(sanitized, { trustedModelShape: layer.trustedModel });
  assert.equal(result.model, undefined);
  assert.equal(result.model_text_layer, undefined);
  assert.equal(result.engine_model, TL_ENGINE);
  assert.equal(result.grade, undefined);
  assert.equal(result.owner_name, "合成 名義");
  // No FIELD carries the old value; it appears only inside the operator-visible manual-entry notice (the PDF evidence).
  const { vehicle_identity_notices: notices = [], ...fields } = result;
  assert.ok(!JSON.stringify(fields).includes(REMARK_OLD_TYPE));
  assert.ok(notices.some((n) => n.startsWith("【要手入力：型式】") && n.includes(REMARK_OLD_TYPE)), notices.join(" | "));
  assert.equal(buildWizardEstimateOcrApplication(result).vehicle.vehicleCode, undefined);
  const review = resolveVehicleIdentity(structuredClone(result), { ambiguousGrade: "blank" }).result;
  assert.equal(review.model, undefined);
  const report = buildOcrQualityReport(review, CTX);
  assert.ok(report.missingRequired.includes("型式"));
  assert.deepEqual(report.manualEntryRequired, ["型式"]);
  assert.equal(report.needsManualCorrection, true);
});

test("R2-4 (server → review): a text-layer 型式 XYZ9 accepted by the server survives the review's re-resolution via provenance, not via any option", () => {
  // Server: selectable PDF whose text layer states 型式 XYZ9 and 原動機の型式 ABC1; the AI leaked the engine code everywhere.
  const extraction = extractCertificateCodesFromLines([`型式 ${TL_TYPE} 原動機の型式 ${TL_ENGINE}`, `型式指定番号 ${PDF_APPROVAL} 類別区分番号 ${PDF_CLASS}`]);
  const sanitized = sanitizeVehicleRegistrationOcrResult({
    vehicle_name: "ホンダ", maker: "ホンダ", model: TL_ENGINE, engine_model: TL_ENGINE, grade: TL_ENGINE,
    owner_name: "合成 名義", license_plate_class: PLATE_CLASS,
  });
  const layer = applyPdfTextLayerCertificateFields(sanitized, extraction);
  assert.equal(layer.trustedModel, true);
  const server = applyVehicleIdentityPolicy(sanitized, { trustedModelShape: layer.trustedModel });
  assert.equal(server.model, TL_TYPE);
  assert.equal(server.model_text_layer, TL_TYPE);
  assert.equal(server.engine_model, TL_ENGINE);

  // Persisted as JSON (ocr_result) and handed to the review, which resolves WITHOUT any trust option.
  const stored = JSON.parse(JSON.stringify(server)) as VehicleRegistrationOcrResult;
  const review = resolveVehicleIdentity(stored, { ambiguousGrade: "blank" });
  assert.equal(review.result.model, TL_TYPE);                 // before the fix: undefined (bare alphanumeric)
  assert.equal(review.result.model_text_layer, TL_TYPE);
  assert.equal(review.result.engine_model, TL_ENGINE);
  assert.equal(review.result.model_code, PDF_APPROVAL);
  assert.equal(review.result.classification_number, PDF_CLASS);
  assert.equal(review.result.grade, undefined);
  assert.equal(review.result.owner_name, "合成 名義");
  assert.equal(review.result.license_plate_class, PLATE_CLASS);
  assert.ok(!review.notices.some((n) => n.includes("ハイフンのない英数字")), review.notices.join(" | "));
  assert.ok(review.notices.some((n) => n.includes("PDFの文字情報から") && n.includes("型式")), review.notices.join(" | ")); // operator-visible provenance notice stays
  assert.deepEqual(resolveVehicleIdentity(review.result, { ambiguousGrade: "blank" }).result, review.result);          // idempotent
  assert.equal(buildWizardEstimateOcrApplication(review.result).vehicle.vehicleCode, TL_TYPE);
  assert.equal(buildWizardEstimateOcrApplication(stored).vehicle.vehicleCode, TL_TYPE);                                // raw path: same provenance
  const report = buildOcrQualityReport(review.result, CTX);
  assert.ok(!report.missingRequired.includes("型式"));
  assert.deepEqual(report.manualEntryRequired, []);

  // Manual correction is preserved: the reviewed payload is applied as typed and never carries the provenance key.
  assert.equal(buildWizardEstimateOcrApplication({ model: "6BA-ABC2" }, { source: "reviewed" }).vehicle.vehicleCode, "6BA-ABC2");
});

test("R2-4 (negative): AI-only, scanned, legacy, forged, mismatching, stale and notice-only claims never validate a bare alphanumeric 型式", () => {
  const bare = (r: VehicleRegistrationOcrResult) => resolveVehicleIdentity(r, { ambiguousGrade: "blank" }).result;

  // AI output claiming provenance: the sanitizer discards every result-internal key, the policy drops the bare code.
  const ai = sanitizeVehicleRegistrationOcrResult({
    maker: "ホンダ", model: TL_TYPE, engine_model: TL_ENGINE,
    model_text_layer: TL_TYPE, model_needs_confirmation: "false", vehicle_identity_notices: ["PDFの文字情報から型式を取得しました。"],
  });
  assert.equal(ai.model_text_layer, undefined);
  assert.equal(ai.model_needs_confirmation, undefined);
  assert.equal(ai.vehicle_identity_notices, undefined);
  const aiResult = applyVehicleIdentityPolicy(ai);
  assert.equal(aiResult.model, undefined);
  assert.equal(aiResult.model_text_layer, undefined);
  assert.ok((aiResult.vehicle_identity_notices ?? []).some((n) => n.includes(TL_TYPE) && n.includes("ハイフンのない英数字")));

  // Scanned PDF / image: no text layer → no provenance → the same AI reading is dropped, on the server and in the review.
  const scanned = sanitizeVehicleRegistrationOcrResult({ maker: "ホンダ", model: TL_TYPE, engine_model: TL_ENGINE });
  const scannedLayer = applyPdfTextLayerCertificateFields(scanned, { status: "no_text", fields: {}, rejected: {}, notices: [], lineCount: 0 });
  assert.equal(scannedLayer.trustedModel, false);
  const scannedResult = applyVehicleIdentityPolicy(scanned, { trustedModelShape: scannedLayer.trustedModel });
  assert.equal(scannedResult.model, undefined);
  assert.equal(bare(JSON.parse(JSON.stringify(scannedResult))).model, undefined);

  // Legacy stored result (before provenance existed): unchanged fail-closed behaviour.
  assert.equal(bare({ model: TL_TYPE, engine_model: TL_ENGINE }).model, undefined);

  // Image upload (no PDF → null extraction) carrying a stale/forged claim: the pure override function itself
  // removes the claim before returning, so the server policy blanks the bare code even without the sanitizer.
  for (const absent of [null, undefined]) {
    const image: VehicleRegistrationOcrResult = { maker: "ホンダ", model: TL_TYPE, engine_model: TL_ENGINE, model_text_layer: TL_TYPE };
    const imageLayer = applyPdfTextLayerCertificateFields(image, absent);
    assert.deepEqual(imageLayer, { applied: [], trustedModel: false, manualEntry: [] });
    assert.equal(image.model_text_layer, undefined);
    assert.equal(image.model, TL_TYPE); // AI reading itself is left for the identity policy, not rewritten here
    const imageResult = applyVehicleIdentityPolicy(image, { trustedModelShape: imageLayer.trustedModel });
    assert.equal(imageResult.model, undefined);
    assert.equal(imageResult.model_text_layer, undefined);
    assert.equal(imageResult.engine_model, TL_ENGINE);
  }

  // Forged / mismatching / orphaned claims: another value is never validated, and the stale claim is removed.
  const mismatch = bare({ model: "ABC9", engine_model: TL_ENGINE, model_text_layer: TL_TYPE });
  assert.equal(mismatch.model, undefined);
  assert.equal(mismatch.model_text_layer, undefined);
  const hyphenated = bare({ model: CERT_TYPE, model_text_layer: TL_TYPE });
  assert.equal(hyphenated.model, CERT_TYPE);            // stands on its own shape …
  assert.equal(hyphenated.model_text_layer, undefined);  // … but the unrelated claim does not travel on
  const orphan = bare({ engine_model: TL_ENGINE, model_text_layer: TL_TYPE });
  assert.equal(orphan.model, undefined);
  assert.equal(orphan.model_text_layer, undefined);
  assert.equal(bare({ model: TL_TYPE, engine_model: TL_ENGINE, model_text_layer: "" }).model, undefined);
  assert.equal(bare({ model: TL_TYPE, engine_model: TL_ENGINE, model_text_layer: "不明" }).model, undefined);
  assert.equal(bare({ model: "xyz9", engine_model: TL_ENGINE, model_text_layer: TL_TYPE }).model, TL_TYPE); // canonical form of the SAME value

  // Provenance never overrides the other safeguards.
  assert.equal(bare({ model: TL_ENGINE, engine_model: TL_ENGINE, model_text_layer: TL_ENGINE }).model, undefined); // equal to engine
  assert.equal(bare({ model: PDF_APPROVAL, model_text_layer: PDF_APPROVAL }).model, undefined);                     // digits only
  const flagged = bare({ model: TL_TYPE, engine_model: TL_ENGINE, model_text_layer: TL_TYPE, model_needs_confirmation: "true" });
  assert.equal(flagged.model, undefined);
  assert.equal(flagged.model_text_layer, undefined);

  // A notice is text, not provenance; a generic non-empty 型式 is not provenance.
  const noticeOnly = bare({ model: TL_TYPE, engine_model: TL_ENGINE, vehicle_identity_notices: ["PDFの文字情報から型式を取得しました。車検証と照合して確認してください。"] });
  assert.equal(noticeOnly.model, undefined);

  // Review source contract: no trust option is passed, and the provenance key is never an editable review field.
  const source = readFileSync("src/components/vehicle-registration/VehicleRegistrationOcrReview.tsx", "utf8");
  assert.ok(!source.includes("trustedModelShape"));
  assert.ok(!/"model_text_layer"/.test(source));
  assert.equal(OCR_FIELD_LABELS.model_text_layer, "型式の出所（PDF文字情報）");
});

// ─── R2-6: the 「旧型式」 qualifier may be whitespace-separated / letter-spaced like the label (「旧 型 式」) ───

test("R2-6 (pipeline): listed-qualifier compounds (「車両の 型 式」, 「この 型 式」, 「従来 型 式」, 「先代 型 式」) never become the accepted 型式; a genuine 型式 on the same page still is", () => {
  // T1 re-baseline: the 「旧 型 式」 variants are OLD-MODEL evidence and moved to the T1 pipeline test below (fail closed).
  const variants = [
    `車両の 型 式 ${REMARK_OLD_TYPE}`, `この 型 式 ${REMARK_OLD_TYPE}`,
    // R2-7: the residual qualifiers 従来 / 先代 (spaced and full-width) follow the same pipeline contract.
    `備考: 従来 型 式 ${REMARK_OLD_TYPE}`, `先代 型 式 ${REMARK_OLD_TYPE}`, "備考：　従来　型　式　６ＢＡ－ＯＬＤ９９９", `先代 型式 ${REMARK_OLD_TYPE}`,
  ];
  for (const remark of variants) {
    // Remark only: nothing anchored, so the server keeps the AI 型式 (here: none), records no provenance, and the
    // review / estimate never see the old type.
    const extraction = extractCertificateCodesFromLines([`原動機の型式 ${TL_ENGINE}`, remark]);
    assert.deepEqual(extraction.fields, { engine_model: TL_ENGINE }, remark);
    assert.deepEqual(extraction.notices, [], remark);
    const sanitized = sanitizeVehicleRegistrationOcrResult({ maker: "ホンダ", engine_model: TL_ENGINE, grade: TL_ENGINE, owner_name: "合成 名義" });
    const layer = applyPdfTextLayerCertificateFields(sanitized, extraction);
    assert.deepEqual(layer, { applied: ["engine_model"], trustedModel: false, manualEntry: [] }, remark);
    const result = applyVehicleIdentityPolicy(sanitized, { trustedModelShape: layer.trustedModel });
    assert.equal(result.model, undefined, remark);
    assert.equal(result.model_text_layer, undefined, remark);
    assert.equal(result.engine_model, TL_ENGINE, remark);
    assert.ok(!JSON.stringify(result).includes(REMARK_OLD_TYPE), remark);
    assert.equal(buildWizardEstimateOcrApplication(result).vehicle.vehicleCode, undefined, remark);
    const review = resolveVehicleIdentity(structuredClone(result), { ambiguousGrade: "blank" }).result;
    assert.equal(review.model, undefined, remark);
    assert.ok(buildOcrQualityReport(review, CTX).missingRequired.includes("型式"), remark);

    // Genuine letter-spaced 型式 at a clean boundary on the same page: applied with provenance, the old type is ignored, no ambiguity.
    const page = extractCertificateCodesFromLines([`型 式 ${CERT_TYPE} 原 動 機 の 型 式 ${TL_ENGINE}`, remark, `型式指定番号 ${PDF_APPROVAL} 類別区分番号 ${PDF_CLASS}`]);
    assert.deepEqual(page.fields, { model: CERT_TYPE, engine_model: TL_ENGINE, model_code: PDF_APPROVAL, classification_number: PDF_CLASS }, remark);
    assert.deepEqual(page.notices, [], remark);
    const pageSanitized = sanitizeVehicleRegistrationOcrResult({ maker: "ホンダ", model: REMARK_OLD_TYPE, engine_model: TL_ENGINE, owner_name: "合成 名義" });
    const pageLayer = applyPdfTextLayerCertificateFields(pageSanitized, page);
    assert.equal(pageLayer.trustedModel, true, remark);
    const pageResult = applyVehicleIdentityPolicy(pageSanitized, { trustedModelShape: pageLayer.trustedModel });
    assert.equal(pageResult.model, CERT_TYPE, remark);
    assert.equal(pageResult.model_text_layer, CERT_TYPE, remark);
    // The old type survives ONLY inside the operator-visible override notice that quotes the replaced AI reading;
    // no field carries it.
    const { vehicle_identity_notices: pageNotices, ...pageFields } = pageResult;
    assert.ok(!JSON.stringify(pageFields).includes(REMARK_OLD_TYPE), remark);
    assert.ok((pageNotices ?? []).some((n) => n.includes(`AI読み取り（${REMARK_OLD_TYPE}）`) && n.includes(`PDFの文字情報（${CERT_TYPE}）`)), remark);
    const pageReview = resolveVehicleIdentity(JSON.parse(JSON.stringify(pageResult)) as VehicleRegistrationOcrResult, { ambiguousGrade: "blank" }).result;
    assert.equal(pageReview.model, CERT_TYPE, remark);
    assert.equal(buildWizardEstimateOcrApplication(pageReview).vehicle.vehicleCode, CERT_TYPE, remark);

    // Stage 1 re-baseline (fail-closed direction): the same page with a 車名 cell directly before the 型式 label on its
    // own row. The 車名 value is an UNLISTED Japanese run — indistinguishable from 「旧来 型 式」 — so the 型式 candidate
    // is suspect-only: rejected, the AI 型式 (here the remark value) withheld, no provenance, manual entry flagged.
    const named = extractCertificateCodesFromLines([`車 名 ホンダ 型 式 ${CERT_TYPE} 原 動 機 の 型 式 ${TL_ENGINE}`, remark, `型式指定番号 ${PDF_APPROVAL} 類別区分番号 ${PDF_CLASS}`]);
    assert.deepEqual(named.fields, { engine_model: TL_ENGINE, model_code: PDF_APPROVAL, classification_number: PDF_CLASS }, remark);
    assert.deepEqual(Object.keys(named.rejected), ["model"], remark);
    const namedSanitized = sanitizeVehicleRegistrationOcrResult({ maker: "ホンダ", model: REMARK_OLD_TYPE, engine_model: TL_ENGINE, owner_name: "合成 名義" });
    const namedLayer = applyPdfTextLayerCertificateFields(namedSanitized, named);
    assert.deepEqual(namedLayer, { applied: ["engine_model", "model_code", "classification_number"], trustedModel: false, manualEntry: ["model"] }, remark);
    const namedResult = applyVehicleIdentityPolicy(namedSanitized, { trustedModelShape: namedLayer.trustedModel });
    assert.equal(namedResult.model, undefined, remark);
    assert.equal(namedResult.model_text_layer, undefined, remark);
    assert.equal(namedResult.engine_model, TL_ENGINE, remark);
    const { vehicle_identity_notices: namedNotices, ...namedFields } = namedResult;
    assert.ok(!JSON.stringify(namedFields).includes(REMARK_OLD_TYPE), remark);
    assert.ok(!JSON.stringify(namedFields).includes(CERT_TYPE), remark);
    assert.ok((namedNotices ?? []).some((n) => n.startsWith("【要手入力：型式】") && n.includes(CERT_TYPE)), remark);
    assert.equal(buildWizardEstimateOcrApplication(namedResult).vehicle.vehicleCode, undefined, remark);
    const namedReport = buildOcrQualityReport(namedResult, CTX);
    assert.equal(namedReport.needsManualCorrection, true, remark);
    assert.deepEqual(namedReport.manualEntryRequired, ["型式"], remark);
  }
});

// ─── Stage 1 (T2): an UNLISTED whitespace-separated qualifier before the same-row 型式 label fails closed end to end ───

test("T2 (pipeline): 「備考: 旧来 型 式 6BA-OLD999」 alone withholds 型式 — same wrong AI value or a different correct-looking one — through server, review, report and estimate", () => {
  const extraction = extractCertificateCodesFromLines([`原動機の型式 ${TL_ENGINE}`, `備考: 旧来 型 式 ${REMARK_OLD_TYPE}`, `型式指定番号 ${PDF_APPROVAL} 類別区分番号 ${PDF_CLASS}`]);
  assert.deepEqual(extraction.fields, { engine_model: TL_ENGINE, model_code: PDF_APPROVAL, classification_number: PDF_CLASS });
  assert.deepEqual(Object.keys(extraction.rejected), ["model"]);
  assert.ok(extraction.rejected.model !== undefined && extraction.rejected.model.startsWith("【要手入力：型式】") && extraction.rejected.model.includes(REMARK_OLD_TYPE), extraction.rejected.model);

  // (A) the AI read the same remark value (the silent case before Stage 1); (B) the AI read a different, correct-looking 型式.
  for (const aiModel of [REMARK_OLD_TYPE, CERT_TYPE]) {
    const sanitized = sanitizeVehicleRegistrationOcrResult({
      vehicle_name: "ホンダ", maker: "ホンダ", model: aiModel, engine_model: TL_ENGINE, grade: TL_ENGINE,
      owner_name: "合成 名義", license_plate_class: PLATE_CLASS,
    });
    const layer = applyPdfTextLayerCertificateFields(sanitized, extraction);
    assert.deepEqual(layer, { applied: ["engine_model", "model_code", "classification_number"], trustedModel: false, manualEntry: ["model"] }, aiModel);
    const result = applyVehicleIdentityPolicy(sanitized, { trustedModelShape: layer.trustedModel });
    assert.equal(result.model, undefined, aiModel);
    assert.equal(result.model_text_layer, undefined, aiModel);
    assert.equal(result.engine_model, TL_ENGINE, aiModel);
    assert.equal(result.model_code, PDF_APPROVAL, aiModel);
    assert.equal(result.classification_number, PDF_CLASS, aiModel);
    assert.equal(result.grade, undefined, aiModel);
    assert.equal(result.vehicle_name, undefined, aiModel);
    assert.equal(result.maker, "ホンダ", aiModel);
    assert.equal(result.owner_name, "合成 名義", aiModel);
    assert.equal(result.license_plate_class, PLATE_CLASS, aiModel);
    // No field carries either value; the withheld AI candidate is echoed in no notice (the manual-entry notice quotes
    // only the PDF evidence, i.e. the remark value and the text that preceded the label).
    const { vehicle_identity_notices: notices = [], ...fields } = result;
    assert.ok(!JSON.stringify(fields).includes(REMARK_OLD_TYPE) && !JSON.stringify(fields).includes(CERT_TYPE), aiModel);
    assert.ok(notices.some((n) => n.startsWith("【要手入力：型式】") && n.includes("（旧来）") && n.includes(REMARK_OLD_TYPE)), notices.join(" | "));
    assert.ok(notices.some((n) => n.includes("AI読み取りの型式") && n.includes("表示しません")), notices.join(" | "));
    assert.ok(notices.every((n) => !n.includes("PDFの文字情報を優先")), notices.join(" | "));
    assert.ok(notices.every((n) => !n.includes(CERT_TYPE)), notices.join(" | "));
    assert.equal(buildWizardEstimateOcrApplication(result).vehicle.vehicleCode, undefined, aiModel);

    const report = buildOcrQualityReport(result, CTX);
    assert.equal(report.needsManualCorrection, true, aiModel);
    assert.deepEqual(report.manualEntryRequired, ["型式"], aiModel);
    assert.ok(report.missingRequired.includes("型式"), aiModel);

    // Review re-resolution (no trust option) keeps the manual-entry state; nothing resurrects a 型式.
    const review = resolveVehicleIdentity(JSON.parse(JSON.stringify(result)) as VehicleRegistrationOcrResult, { ambiguousGrade: "blank" });
    assert.equal(review.result.model, undefined, aiModel);
    assert.equal(review.result.model_text_layer, undefined, aiModel);
    assert.deepEqual(buildOcrQualityReport(review.result, CTX).manualEntryRequired, ["型式"], aiModel);
    assert.equal(buildWizardEstimateOcrApplication(review.result).vehicle.vehicleCode, undefined, aiModel);
  }

  // (C) T2 + a clean 型式 label with a DIFFERENT value: the existing ambiguity rejection (unchanged) — still blank.
  const ambiguous = extractCertificateCodesFromLines([`型式 ${CERT_TYPE}`, `備考: 旧来 型 式 ${REMARK_OLD_TYPE}`]);
  assert.deepEqual(Object.keys(ambiguous.rejected), ["model"]);
  assert.ok(ambiguous.rejected.model !== undefined && ambiguous.rejected.model.includes("候補が複数"), ambiguous.rejected.model);
  const ambiguousSanitized = sanitizeVehicleRegistrationOcrResult({ maker: "ホンダ", model: REMARK_OLD_TYPE });
  assert.deepEqual(applyPdfTextLayerCertificateFields(ambiguousSanitized, ambiguous).manualEntry, ["model"]);
  assert.equal(applyVehicleIdentityPolicy(ambiguousSanitized, { trustedModelShape: false }).model, undefined);

  // Suspect + clean label with the SAME value: the clean occurrence justifies acceptance, with provenance.
  const agreed = extractCertificateCodesFromLines([`車 名 ホンダ 型 式 ${CERT_TYPE}`, `型式 ${CERT_TYPE} 原動機の型式 ${TL_ENGINE}`]);
  assert.deepEqual(agreed.fields, { model: CERT_TYPE, engine_model: TL_ENGINE });
  assert.deepEqual(agreed.rejected, {});
  const agreedSanitized = sanitizeVehicleRegistrationOcrResult({ maker: "ホンダ", model: REMARK_OLD_TYPE, engine_model: TL_ENGINE });
  const agreedLayer = applyPdfTextLayerCertificateFields(agreedSanitized, agreed);
  assert.equal(agreedLayer.trustedModel, true);
  const agreedResult = applyVehicleIdentityPolicy(agreedSanitized, { trustedModelShape: agreedLayer.trustedModel });
  assert.equal(agreedResult.model, CERT_TYPE);
  assert.equal(agreedResult.model_text_layer, CERT_TYPE);
  assert.equal(buildWizardEstimateOcrApplication(agreedResult).vehicle.vehicleCode, CERT_TYPE);

  // Scanned / image PDF (no text layer): unchanged — the text layer cannot see a remark it never read (documented residual).
  const scanned = sanitizeVehicleRegistrationOcrResult({ maker: "ホンダ", model: CERT_TYPE, engine_model: TL_ENGINE });
  const scannedLayer = applyPdfTextLayerCertificateFields(scanned, { status: "no_text", fields: {}, rejected: {}, notices: [], lineCount: 0 });
  assert.deepEqual(scannedLayer.manualEntry, []);
  assert.equal(applyVehicleIdentityPolicy(scanned, { trustedModelShape: scannedLayer.trustedModel }).model, CERT_TYPE);
});

// ─── T1: the 「旧型式」 annotation is OLD-MODEL evidence — an old-model-only 型式 fails closed end to end (Owner-approved) ───

test("T1 (pipeline): 「旧型式 6BA-OLD999」 (glued / spaced / full-width) alone withholds 型式 — same wrong AI value or a different correct-looking one — through server, review, report and estimate; clean+old same is accepted, different is ambiguous", () => {
  for (const remark of [`備考: 旧型式 ${REMARK_OLD_TYPE}`, `備考: 旧 型 式 ${REMARK_OLD_TYPE}`, `旧 型式 ${REMARK_OLD_TYPE}`, "備考：　旧　型　式　６ＢＡ－ＯＬＤ９９９", `旧型式:${REMARK_OLD_TYPE}`]) {
    const extraction = extractCertificateCodesFromLines([`原動機の型式 ${TL_ENGINE}`, remark, `型式指定番号 ${PDF_APPROVAL} 類別区分番号 ${PDF_CLASS}`]);
    assert.deepEqual(extraction.fields, { engine_model: TL_ENGINE, model_code: PDF_APPROVAL, classification_number: PDF_CLASS }, remark);
    assert.deepEqual(Object.keys(extraction.rejected), ["model"], remark);
    assert.ok(extraction.rejected.model !== undefined && extraction.rejected.model.startsWith("【要手入力：型式】") && extraction.rejected.model.includes("旧型式") && extraction.rejected.model.includes(REMARK_OLD_TYPE), extraction.rejected.model);

    // (A) the AI read the same old value (the T1 gap: before this fix it survived as the fallback); (B) a different, correct-looking 型式.
    for (const aiModel of [REMARK_OLD_TYPE, CERT_TYPE]) {
      const sanitized = sanitizeVehicleRegistrationOcrResult({
        vehicle_name: "ホンダ", maker: "ホンダ", model: aiModel, engine_model: TL_ENGINE, grade: TL_ENGINE,
        owner_name: "合成 名義", license_plate_class: PLATE_CLASS,
      });
      const layer = applyPdfTextLayerCertificateFields(sanitized, extraction);
      assert.deepEqual(layer, { applied: ["engine_model", "model_code", "classification_number"], trustedModel: false, manualEntry: ["model"] }, `${remark} / ${aiModel}`);
      const result = applyVehicleIdentityPolicy(sanitized, { trustedModelShape: layer.trustedModel });
      assert.equal(result.model, undefined, aiModel);
      assert.equal(result.model_text_layer, undefined, aiModel);
      assert.equal(result.engine_model, TL_ENGINE, aiModel);
      assert.equal(result.model_code, PDF_APPROVAL, aiModel);
      assert.equal(result.classification_number, PDF_CLASS, aiModel);
      assert.equal(result.grade, undefined, aiModel);
      assert.equal(result.vehicle_name, undefined, aiModel);
      assert.equal(result.maker, "ホンダ", aiModel);
      assert.equal(result.owner_name, "合成 名義", aiModel);
      assert.equal(result.license_plate_class, PLATE_CLASS, aiModel);
      const { vehicle_identity_notices: notices = [], ...fields } = result;
      assert.ok(!JSON.stringify(fields).includes(REMARK_OLD_TYPE) && !JSON.stringify(fields).includes(CERT_TYPE), aiModel);
      assert.ok(notices.some((n) => n.startsWith("【要手入力：型式】") && n.includes("旧型式") && n.includes(REMARK_OLD_TYPE)), notices.join(" | "));
      assert.ok(notices.some((n) => n.includes("AI読み取りの型式") && n.includes("表示しません")), notices.join(" | "));
      assert.ok(notices.every((n) => !n.includes("PDFの文字情報を優先")), notices.join(" | "));
      assert.ok(notices.every((n) => !n.includes(CERT_TYPE)), notices.join(" | ")); // the withheld AI candidate is never echoed
      assert.equal(buildWizardEstimateOcrApplication(result).vehicle.vehicleCode, undefined, aiModel);
      const report = buildOcrQualityReport(result, CTX);
      assert.equal(report.needsManualCorrection, true, aiModel);
      assert.deepEqual(report.manualEntryRequired, ["型式"], aiModel);
      assert.ok(report.missingRequired.includes("型式"), aiModel);
      const review = resolveVehicleIdentity(JSON.parse(JSON.stringify(result)) as VehicleRegistrationOcrResult, { ambiguousGrade: "blank" });
      assert.equal(review.result.model, undefined, aiModel);
      assert.equal(review.result.model_text_layer, undefined, aiModel);
      assert.deepEqual(buildOcrQualityReport(review.result, CTX).manualEntryRequired, ["型式"], aiModel);
      assert.equal(buildWizardEstimateOcrApplication(review.result).vehicle.vehicleCode, undefined, aiModel);
    }

    // (C) a clean 型式 with a DIFFERENT value on the same page → the existing ambiguity rejection — still blank, other codes kept.
    const ambiguous = extractCertificateCodesFromLines([`型 式 ${CERT_TYPE} 原 動 機 の 型 式 ${TL_ENGINE}`, remark, `型式指定番号 ${PDF_APPROVAL} 類別区分番号 ${PDF_CLASS}`]);
    assert.deepEqual(ambiguous.fields, { engine_model: TL_ENGINE, model_code: PDF_APPROVAL, classification_number: PDF_CLASS }, remark);
    assert.ok(ambiguous.rejected.model !== undefined && ambiguous.rejected.model.includes("候補が複数"), remark);
    const ambiguousSanitized = sanitizeVehicleRegistrationOcrResult({ maker: "ホンダ", model: CERT_TYPE, engine_model: TL_ENGINE });
    const ambiguousLayer = applyPdfTextLayerCertificateFields(ambiguousSanitized, ambiguous);
    assert.deepEqual(ambiguousLayer, { applied: ["engine_model", "model_code", "classification_number"], trustedModel: false, manualEntry: ["model"] }, remark);
    const ambiguousResult = applyVehicleIdentityPolicy(ambiguousSanitized, { trustedModelShape: ambiguousLayer.trustedModel });
    assert.equal(ambiguousResult.model, undefined, remark);
    assert.equal(ambiguousResult.model_text_layer, undefined, remark);
    assert.equal(buildWizardEstimateOcrApplication(ambiguousResult).vehicle.vehicleCode, undefined, remark);
    assert.deepEqual(buildOcrQualityReport(ambiguousResult, CTX).manualEntryRequired, ["型式"], remark);
  }

  // (D) a clean 型式 with the SAME value as the old-model annotation → accepted with provenance, like a plain clean label.
  const agreed = extractCertificateCodesFromLines([`型式 ${CERT_TYPE} 原動機の型式 ${TL_ENGINE}`, `備考: 旧型式 ${CERT_TYPE}`]);
  assert.deepEqual(agreed.fields, { model: CERT_TYPE, engine_model: TL_ENGINE });
  assert.deepEqual(agreed.rejected, {});
  const agreedSanitized = sanitizeVehicleRegistrationOcrResult({ maker: "ホンダ", model: REMARK_OLD_TYPE, engine_model: TL_ENGINE });
  const agreedLayer = applyPdfTextLayerCertificateFields(agreedSanitized, agreed);
  assert.equal(agreedLayer.trustedModel, true);
  const agreedResult = applyVehicleIdentityPolicy(agreedSanitized, { trustedModelShape: agreedLayer.trustedModel });
  assert.equal(agreedResult.model, CERT_TYPE);
  assert.equal(agreedResult.model_text_layer, CERT_TYPE);
  assert.equal(buildWizardEstimateOcrApplication(agreedResult).vehicle.vehicleCode, CERT_TYPE);

  // Negative controls: 「旧」 before 型式指定番号 / 原動機の型式 is NOT old-model 型式 evidence (nothing anchored, AI 型式 kept as
  // fallback); a scanned / image PDF (no text layer) is unchanged — the text layer cannot see a remark it never read.
  for (const line of [`旧型式指定番号 ${PDF_APPROVAL}`, `旧 原動機の型式 ${TL_ENGINE}`]) {
    const extraction = extractCertificateCodesFromLines([line]);
    assert.deepEqual(extraction.rejected, {}, line);
    const kept = sanitizeVehicleRegistrationOcrResult({ maker: "ホンダ", model: CERT_TYPE, engine_model: TL_ENGINE });
    assert.deepEqual(applyPdfTextLayerCertificateFields(kept, extraction).manualEntry, [], line);
    assert.equal(applyVehicleIdentityPolicy(kept, { trustedModelShape: false }).model, CERT_TYPE, line);
  }
  const scanned = sanitizeVehicleRegistrationOcrResult({ maker: "ホンダ", model: CERT_TYPE, engine_model: TL_ENGINE });
  const scannedLayer = applyPdfTextLayerCertificateFields(scanned, { status: "no_text", fields: {}, rejected: {}, notices: [], lineCount: 0 });
  assert.deepEqual(scannedLayer.manualEntry, []);
  assert.equal(applyVehicleIdentityPolicy(scanned, { trustedModelShape: scannedLayer.trustedModel }).model, CERT_TYPE);
});

// ─── T1-2: the 「旧型式」 annotation on a two-row label row with a remark head (「備考」+「旧型式」 / 「備考旧型式」) fails closed end to end ───

test("T1-2 (pipeline): 「備考」+「旧型式」 or 「備考旧型式」 above the old value withholds 型式 — same wrong AI value or a different correct-looking one — through server, review, report and estimate; clean+old same is accepted, different is ambiguous; 旧 before other labels is untouched", () => {
  const CLS_COLUMN: PdfTextItemLike[] = [{ str: "類別区分番号", x: 480, y: 500, width: 60, height: 10 }, { str: PDF_CLASS, x: 480, y: 492, width: 40, height: 10 }];
  const ENGINE_ROW: PdfTextItemLike[] = [{ str: "原動機の型式", x: 40, y: 740, width: 60, height: 10 }, { str: TL_ENGINE, x: 120, y: 740, width: 40, height: 10 }];
  const valueBelow = (x: number, value: string): PdfTextItemLike => ({ str: value, x, y: 492, width: 80, height: 10 });
  const cleanRow = (value: string): PdfTextItemLike[] => [{ str: "型式", x: 40, y: 300, width: 20, height: 10 }, { str: value, x: 70, y: 300, width: 80, height: 10 }];

  for (const { name, labels, valueX } of [
    { name: "備考 + 旧型式 (adjacent)", valueX: 64, labels: [{ str: "備考", x: 40, y: 500, width: 20, height: 10 }, { str: "旧型式", x: 64, y: 500, width: 30, height: 10 }] },
    { name: "備考旧型式 (glued)",       valueX: 40, labels: [{ str: "備考旧型式", x: 40, y: 500, width: 50, height: 10 }] },
    { name: "備考 + 旧 + 型 + 式",      valueX: 64, labels: [{ str: "備考", x: 40, y: 500, width: 20, height: 10 }, { str: "旧", x: 64, y: 500, width: 10, height: 10 }, { str: "型", x: 76, y: 500, width: 10, height: 10 }, { str: "式", x: 88, y: 500, width: 10, height: 10 }] },
  ] as Array<{ name: string; labels: PdfTextItemLike[]; valueX: number }>) {
    const extraction = extractCertificateCodesFromItems([...ENGINE_ROW, ...labels, valueBelow(valueX, REMARK_OLD_TYPE), ...CLS_COLUMN]);
    assert.deepEqual(extraction.fields, { engine_model: TL_ENGINE, classification_number: PDF_CLASS }, name);
    assert.deepEqual(Object.keys(extraction.rejected), ["model"], name);
    assert.ok(extraction.rejected.model !== undefined && extraction.rejected.model.startsWith("【要手入力：型式】") && extraction.rejected.model.includes("旧型式") && extraction.rejected.model.includes(REMARK_OLD_TYPE), `${name}: ${extraction.rejected.model}`);

    // (A) the AI read the same old value (the silent residual before this fix); (B) a different, correct-looking 型式.
    for (const aiModel of [REMARK_OLD_TYPE, CERT_TYPE]) {
      const tag = `${name} / ${aiModel}`;
      const sanitized = sanitizeVehicleRegistrationOcrResult({
        vehicle_name: "ホンダ", maker: "ホンダ", model: aiModel, engine_model: TL_ENGINE, grade: TL_ENGINE,
        owner_name: "合成 名義", license_plate_class: PLATE_CLASS,
      });
      const layer = applyPdfTextLayerCertificateFields(sanitized, extraction);
      assert.deepEqual(layer, { applied: ["engine_model", "classification_number"], trustedModel: false, manualEntry: ["model"] }, tag);
      const result = applyVehicleIdentityPolicy(sanitized, { trustedModelShape: layer.trustedModel });
      assert.equal(result.model, undefined, tag);
      assert.equal(result.model_text_layer, undefined, tag);
      assert.equal(result.engine_model, TL_ENGINE, tag);
      assert.equal(result.classification_number, "0007", tag); // leading zero preserved beside the rejection
      assert.notEqual(result.classification_number, result.license_plate_class, tag);
      assert.equal(result.grade, undefined, tag);
      assert.equal(result.vehicle_name, undefined, tag);
      assert.equal(result.maker, "ホンダ", tag);
      assert.equal(result.owner_name, "合成 名義", tag);
      assert.equal(result.license_plate_class, PLATE_CLASS, tag);
      const { vehicle_identity_notices: notices = [], ...fields } = result;
      assert.ok(!JSON.stringify(fields).includes(REMARK_OLD_TYPE) && !JSON.stringify(fields).includes(CERT_TYPE), tag);
      assert.ok(notices.some((n) => n.startsWith("【要手入力：型式】") && n.includes("旧型式") && n.includes(REMARK_OLD_TYPE)), notices.join(" | "));
      assert.ok(notices.some((n) => n.includes("AI読み取りの型式") && n.includes("表示しません")), notices.join(" | "));
      assert.ok(notices.every((n) => !n.includes("PDFの文字情報を優先") && !n.includes(CERT_TYPE)), notices.join(" | ")); // the withheld AI candidate is never echoed
      assert.equal(buildWizardEstimateOcrApplication(result).vehicle.vehicleCode, undefined, tag);
      const report = buildOcrQualityReport(result, CTX);
      assert.equal(report.needsManualCorrection, true, tag);
      assert.deepEqual(report.manualEntryRequired, ["型式"], tag);
      assert.ok(report.missingRequired.includes("型式"), tag);
      const review = resolveVehicleIdentity(JSON.parse(JSON.stringify(result)) as VehicleRegistrationOcrResult, { ambiguousGrade: "blank" });
      assert.equal(review.result.model, undefined, tag);
      assert.equal(review.result.model_text_layer, undefined, tag);
      assert.deepEqual(buildOcrQualityReport(review.result, CTX).manualEntryRequired, ["型式"], tag);
      assert.equal(buildWizardEstimateOcrApplication(review.result).vehicle.vehicleCode, undefined, tag);
    }

    // (C) a clean current 型式 on its own row with the SAME value → accepted with provenance, estimate 型式 filled; (D) DIFFERENT → ambiguity, blank.
    const agreed = extractCertificateCodesFromItems([...ENGINE_ROW, ...labels, valueBelow(valueX, CERT_TYPE), ...CLS_COLUMN, ...cleanRow(CERT_TYPE)]);
    assert.deepEqual(agreed.fields, { model: CERT_TYPE, engine_model: TL_ENGINE, classification_number: PDF_CLASS }, name);
    assert.deepEqual(agreed.rejected, {}, name);
    const agreedSanitized = sanitizeVehicleRegistrationOcrResult({ maker: "ホンダ", model: REMARK_OLD_TYPE, engine_model: TL_ENGINE });
    const agreedLayer = applyPdfTextLayerCertificateFields(agreedSanitized, agreed);
    assert.equal(agreedLayer.trustedModel, true, name);
    const agreedResult = applyVehicleIdentityPolicy(agreedSanitized, { trustedModelShape: agreedLayer.trustedModel });
    assert.equal(agreedResult.model, CERT_TYPE, name);
    assert.equal(agreedResult.model_text_layer, CERT_TYPE, name);
    assert.equal(buildWizardEstimateOcrApplication(agreedResult).vehicle.vehicleCode, CERT_TYPE, name);

    const ambiguous = extractCertificateCodesFromItems([...ENGINE_ROW, ...labels, valueBelow(valueX, REMARK_OLD_TYPE), ...CLS_COLUMN, ...cleanRow(CERT_TYPE)]);
    assert.ok(ambiguous.rejected.model !== undefined && ambiguous.rejected.model.includes("候補が複数"), name);
    const ambiguousSanitized = sanitizeVehicleRegistrationOcrResult({ maker: "ホンダ", model: CERT_TYPE, engine_model: TL_ENGINE });
    const ambiguousLayer = applyPdfTextLayerCertificateFields(ambiguousSanitized, ambiguous);
    assert.deepEqual(ambiguousLayer, { applied: ["engine_model", "classification_number"], trustedModel: false, manualEntry: ["model"] }, name);
    const ambiguousResult = applyVehicleIdentityPolicy(ambiguousSanitized, { trustedModelShape: ambiguousLayer.trustedModel });
    assert.equal(ambiguousResult.model, undefined, name);
    assert.equal(buildWizardEstimateOcrApplication(ambiguousResult).vehicle.vehicleCode, undefined, name);
    assert.deepEqual(buildOcrQualityReport(ambiguousResult, CTX).manualEntryRequired, ["型式"], name);
  }

  // Negative controls: the same remark head before 型式指定番号 / 原動機の型式 is NOT old-model 型式 evidence (nothing anchored,
  // nothing rejected, the AI 型式 stays the fallback and reaches the estimate); a scanned / image PDF is unchanged.
  for (const { name, labels, value } of [
    { name: "備考 + 旧型式指定番号", labels: [{ str: "備考", x: 40, y: 500, width: 20, height: 10 }, { str: "旧型式指定番号", x: 64, y: 500, width: 70, height: 10 }], value: PDF_APPROVAL },
    { name: "備考旧型式指定番号",    labels: [{ str: "備考旧型式指定番号", x: 40, y: 500, width: 90, height: 10 }], value: PDF_APPROVAL },
    { name: "備考 + 旧原動機の型式", labels: [{ str: "備考", x: 40, y: 500, width: 20, height: 10 }, { str: "旧原動機の型式", x: 64, y: 500, width: 70, height: 10 }], value: TL_ENGINE },
    { name: "備考旧原動機の型式",    labels: [{ str: "備考旧原動機の型式", x: 40, y: 500, width: 90, height: 10 }], value: TL_ENGINE },
  ] as Array<{ name: string; labels: PdfTextItemLike[]; value: string }>) {
    const extraction = extractCertificateCodesFromItems([...labels, { str: value, x: 40, y: 492, width: 60, height: 10 }, ...CLS_COLUMN]);
    assert.deepEqual(extraction.fields, { classification_number: PDF_CLASS }, name);
    assert.deepEqual(extraction.rejected, {}, name);
    const kept = sanitizeVehicleRegistrationOcrResult({ maker: "ホンダ", model: CERT_TYPE, engine_model: TL_ENGINE });
    const keptLayer = applyPdfTextLayerCertificateFields(kept, extraction);
    assert.deepEqual(keptLayer, { applied: ["classification_number"], trustedModel: false, manualEntry: [] }, name);
    const keptResult = applyVehicleIdentityPolicy(kept, { trustedModelShape: keptLayer.trustedModel });
    assert.equal(keptResult.model, CERT_TYPE, name);
    assert.equal(keptResult.engine_model, TL_ENGINE, name);
    assert.equal(keptResult.classification_number, "0007", name);
    assert.equal(buildWizardEstimateOcrApplication(keptResult).vehicle.vehicleCode, CERT_TYPE, name);
  }
  const scanned = sanitizeVehicleRegistrationOcrResult({ maker: "ホンダ", model: CERT_TYPE, engine_model: TL_ENGINE });
  assert.deepEqual(applyPdfTextLayerCertificateFields(scanned, { status: "no_text", fields: {}, rejected: {}, notices: [], lineCount: 0 }).manualEntry, []);
  assert.equal(applyVehicleIdentityPolicy(scanned, { trustedModelShape: false }).model, CERT_TYPE);
});
