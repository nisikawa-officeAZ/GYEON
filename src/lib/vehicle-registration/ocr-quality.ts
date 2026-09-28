// OCR quality report produced after each scan (req 7).
// Pure module. Safe for client or server import.

import type { VehicleRegistrationOcrResult } from "./vehicle-registration-types";

export interface OcrQualityReport {
  model:                 string;
  promptVersion:         string;
  confidence:            number | null;   // 0..1
  missingRequired:       string[];        // Japanese labels of missing required fields
  warnings:              string[];
  processingMs:          number | null;
  needsManualCorrection: boolean;
  manualRequired:        string[];        // fields the operator must always fill (color)
  manualEntryRequired:   string[];        // certificate fields withheld by a 【要手入力】 notice (see below)
}

// OCR-extractable REQUIRED fields (key → Japanese label). 車名（通称名）/ body color /
// body size are NOT here — the certificate does not carry them, so they are
// manual-required (see below).
const REQUIRED_FIELDS: { key: keyof VehicleRegistrationOcrResult; label: string }[] = [
  { key: "maker",                   label: "メーカー" },
  { key: "model",                   label: "型式" },
  { key: "first_registration_date", label: "初度登録年月" },
  { key: "registration_date",       label: "登録年月日" },
  { key: "inspection_expiry_date",  label: "車検満了日" },
  { key: "license_plate_number",    label: "ナンバー" },
  { key: "chassis_number",          label: "車台番号" },
  { key: "displacement",            label: "排気量" },
];

const LOW_CONFIDENCE = 0.6;

function present(v: unknown): boolean {
  return typeof v === "string" && v.trim() !== "";
}

export function buildOcrQualityReport(
  result: VehicleRegistrationOcrResult,
  ctx: { model: string; promptVersion: string; processingMs: number | null },
): OcrQualityReport {
  const missingRequired = REQUIRED_FIELDS.filter((f) => !present(result[f.key])).map((f) => f.label);

  const warnings: string[] = [];
  const conf = typeof result.confidence === "number" ? result.confidence : null;
  if (conf !== null && conf < LOW_CONFIDENCE) warnings.push("読み取り信頼度が低い可能性があります");

  // Customer presence (所有者 / 使用者)
  if (!present(result.owner_name) && !present(result.user_name)) {
    warnings.push("所有者・使用者を読み取れませんでした");
  }
  if (result.owner_user_separated === "true") {
    warnings.push("所有者と使用者が異なります（顧客対象を確認してください）");
  }
  if (missingRequired.length > 0) {
    warnings.push(`未取得の必須項目: ${missingRequired.join("、")}`);
  }

  // Vehicle-identity resolution notices (excluded 型式・グレード values) are operator-facing. Those that
  // WITHHOLD a certificate field (【要手入力：<欄>】…, from the PDF text layer) also name the fields the
  // operator must now enter by hand — read from the marker, never from the prose.
  const manualEntryRequired: string[] = [];
  for (const notice of result.vehicle_identity_notices ?? []) {
    warnings.push(notice);
    for (const label of manualEntryLabels(notice)) {
      if (!manualEntryRequired.includes(label)) manualEntryRequired.push(label);
    }
  }

  // Always manual (not printed on the certificate): 車名（通称名）, ボディカラー
  const manualRequired = ["車名", "ボディカラー"];

  const needsManualCorrection =
    missingRequired.length > 0 || (conf !== null && conf < LOW_CONFIDENCE) || manualEntryRequired.length > 0;

  return {
    model:          ctx.model,
    promptVersion:  ctx.promptVersion,
    confidence:     conf,
    missingRequired,
    warnings,
    processingMs:   ctx.processingMs,
    needsManualCorrection,
    manualRequired,
    manualEntryRequired,
  };
}

// ─── Manual-entry notices ────────────────────────────────────────────────────
//
// A notice that WITHHOLDS a certificate code field — the PDF text layer saw a labelled value for it but
// rejected it (glued / modified text, several values, wrong shape, same value under two labels) — starts
// with the marker 【要手入力：<欄>】 (several fields joined by 「・」). The field's AI reading is removed with
// it (pdf-text-layer.ts), and the quality report reads the marker to flag manual correction.

const MANUAL_ENTRY_MARKER = /^【要手入力：([^】]+)】/;

/** Builds an operator-facing notice that requires manual entry of the named certificate field(s). */
export function manualEntryNotice(labels: readonly string[], message: string): string {
  return `【要手入力：${labels.join("・")}】${message}`;
}

/** Field labels named by a manual-entry notice; empty for every other notice. */
export function manualEntryLabels(notice: string): string[] {
  const match = MANUAL_ENTRY_MARKER.exec(notice);
  return match === null ? [] : match[1].split("・").filter((label) => label !== "");
}

// ─── Vehicle-identity resolution ─────────────────────────────────────────────
//
// Separates the certificate 型式 (model), 原動機の型式 (engine_model), 型式指定番号 (model_code),
// 類別区分番号 (classification_number) and the operator-only グレード (grade). Deterministic and
// idempotent; never invents a value. When the source column of a value is ambiguous the value is
// BLANKED and an operator-visible notice is recorded instead of guessing. The ナンバープレート
// 分類番号 (license_plate_class) is a separate column and is never touched here.

export type VehicleIdentityOptions = {
  /**
   * "blank": an OCR-sourced grade that merely LOOKS like an engine/type code (legacy replay where the
   *          old prompt had no engine_model to compare against) is blanked with a visible notice.
   * "keep":  only a grade that EQUALS an extracted code is dropped, so an operator-entered grade that
   *          is distinct from the engine code always survives apply.
   */
  ambiguousGrade: "blank" | "keep";
  /**
   * true ONLY when 型式 was written by the deterministic PDF text layer (pdf-text-layer.ts) with exact
   * label anchoring and conflict checks. Bypasses the hyphen-less code-shape rejection alone; the
   * digits-only, equal-to-engine and every other safeguard still apply. Never set for AI output.
   * The same trust is derived WITHOUT this option from the result's own provenance (`model_text_layer`,
   * written by pdf-text-layer.ts) — but only while 型式 still equals that exact value — so the review,
   * which has no server context, re-resolves a stored text-layer 型式 exactly as the server accepted it.
   */
  trustedModelShape?: boolean;
};

export interface VehicleIdentityResolution {
  result:                 VehicleRegistrationOcrResult;
  notices:                string[];
}

const CODE_FIELDS = ["model", "engine_model", "model_code", "classification_number"] as const;

/** Canonical form for certificate codes: full-width → ASCII, hyphen variants → "-", no spaces, upper. */
export function foldVehicleCode(raw: unknown): string {
  if (typeof raw !== "string") return "";
  const folded = raw
    .replace(/[\uFF01-\uFF5E]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
    .replace(/[\u2010-\u2015\u2212\u30FC\uFF70]/g, "-")
    .replace(/[\s\u3000]+/g, "")
    .toUpperCase();
  // Non-code text (e.g. 型式「不明」 on a parallel import) is kept verbatim, only trimmed.
  return /^[A-Z0-9-]+$/.test(folded) ? folded : raw.trim();
}

const isDigitsOnly            = (v: string) => /^\d+$/.test(v);
const isTypeApprovalNumber    = (v: string) => /^\d{1,6}$/.test(v);   // 型式指定番号: digits only
const isClassificationNumber  = (v: string) => /^\d{1,5}$/.test(v);   // 類別区分番号: digits only
/** A hyphen-less alphanumeric token with a digit (e.g. a kei engine type) can never be a 型式. */
const isBareAlnumCode         = (v: string) => /^[A-Z0-9]+$/.test(v) && /\d/.test(v);
/** Engine-type-like token (letters + digits, optional hyphen part) — used for the ambiguous grade guard. */
const looksLikeEngineCode     = (v: string) =>
  /^[A-Z0-9]{2,8}(-[A-Z0-9]{1,8})?$/.test(v) && /\d/.test(v) && /[A-Z]/.test(v);

export function resolveVehicleIdentity(
  input: VehicleRegistrationOcrResult,
  opts: VehicleIdentityOptions,
): VehicleIdentityResolution {
  const result: VehicleRegistrationOcrResult = { ...input };
  const notices: string[] = [...(input.vehicle_identity_notices ?? [])];
  const note = (message: string) => { if (!notices.includes(message)) notices.push(message); };

  // 1) Canonical code form (lossless; blanks removed).
  for (const key of CODE_FIELDS) {
    const folded = foldVehicleCode(result[key]);
    if (folded === "") delete result[key];
    else result[key] = folded;
  }
  const inputCodes = CODE_FIELDS.map((key) => foldVehicleCode(input[key])).filter((v) => v !== "");

  // 型式 provenance. pdf-text-layer.ts records the exact 型式 it verified in `model_text_layer` (server
  // side; the AI sanitizer never passes this key through, and the review never edits it). It is a claim
  // about ONE exact value: honoured only while 型式 still equals it, dropped here and re-attached at the
  // end only if 型式 survives every rule below unchanged. A legacy result, a scan, a forged or stale claim,
  // or a claim for a different value therefore never softens the shape rule for anything else.
  const textLayerModel = foldVehicleCode(input.model_text_layer);
  delete result.model_text_layer;
  const modelHasTextLayerProvenance =
    /^[A-Z0-9-]+$/.test(textLayerModel) && result.model !== undefined && result.model === textLayerModel;
  const trustedModelShape = opts.trustedModelShape === true || modelHasTextLayerProvenance;

  // Old OCR results may contain a value moved from a different column. Never treat it as
  // certificate 型式; ask the operator to read that column and enter it explicitly.
  if (input.model_needs_confirmation === "true") {
    delete result.model;
    note("以前の読み取りで他の欄から退避した型式は除外しました。車検証の型式欄を確認して手入力してください。");
  }
  delete result.model_needs_confirmation;

  // 2) 型式 vs 原動機の型式 — the same value cannot be both.
  if (result.model && result.engine_model && result.model === result.engine_model) {
    note(`型式欄に原動機の型式と同じ値（${result.model}）が入っていたため、型式を空にしました。車検証の型式欄を確認してください。`);
    delete result.model;
  }

  // 3) 型式指定番号 is digits only. Values from this column never become 型式.
  const approval = result.model_code ?? "";
  if (approval !== "" && !isTypeApprovalNumber(approval)) {
    delete result.model_code;
    if (result.model && result.model === approval) {
      note(`型式指定番号欄に型式と同じ値（${approval}）が入っていたため、型式指定番号を空にしました。`);
    } else {
      note(`型式指定番号は数字のみです。「${approval}」は除外しました。型式は自動補完せず、車検証の型式欄を確認して手入力してください。`);
    }
  }

  // 4) 型式 sanity — values that cannot be a certificate 型式 are blanked, not reinterpreted.
  const model = result.model ?? "";
  if (model !== "" && isDigitsOnly(model)) {
    delete result.model;
    note(`型式欄に数字のみの値（${model}）が入っていたため空にしました。型式指定番号と混同している可能性があります。`);
  } else if (model !== "" && isBareAlnumCode(model) && !trustedModelShape) {
    delete result.model;
    note(`型式欄の値（${model}）はハイフンのない英数字のみで原動機の型式の可能性があるため空にしました。車検証の型式欄を確認してください。`);
  }

  // 5) 類別区分番号 is digits only (separate from the plate 分類番号, which is left untouched).
  const classification = result.classification_number ?? "";
  if (classification !== "" && !isClassificationNumber(classification)) {
    delete result.classification_number;
    note(`類別区分番号は数字のみです。「${classification}」は除外しました。`);
  }

  // 6) グレード is never a code. Equal-to-a-code is dropped everywhere; merely code-LIKE only when asked.
  const gradeRaw = typeof result.grade === "string" ? result.grade.trim() : "";
  if (gradeRaw === "") {
    delete result.grade;
  } else {
    const grade = foldVehicleCode(gradeRaw);
    if (inputCodes.includes(grade)) {
      delete result.grade;
      note(`グレード欄に原動機の型式などのコード（${grade}）が入っていたため空にしました。グレードは車検証に記載がないため必要なら手入力してください。`);
    } else if (opts.ambiguousGrade === "blank" && looksLikeEngineCode(grade)) {
      delete result.grade;
      note(`グレード欄の値（${gradeRaw}）は原動機の型式などのコードの可能性があるため空にしました。正しいグレードなら手入力してください。`);
    }
  }

  // Provenance travels on only with the very 型式 it vouches for (idempotent re-resolution in the review).
  if (modelHasTextLayerProvenance && result.model === textLayerModel) result.model_text_layer = textLayerModel;

  if (notices.length > 0) result.vehicle_identity_notices = notices;
  else delete result.vehicle_identity_notices;

  return { result, notices };
}
