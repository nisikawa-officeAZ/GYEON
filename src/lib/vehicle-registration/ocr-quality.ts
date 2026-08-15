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
}

// OCR-extractable REQUIRED fields (key → Japanese label). Body color / body size
// are NOT here — they are manual-required (see below).
const REQUIRED_FIELDS: { key: keyof VehicleRegistrationOcrResult; label: string }[] = [
  { key: "maker",                   label: "メーカー" },
  { key: "vehicle_name",            label: "車名" },
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

  // Always manual (never on the certificate reliably)
  const manualRequired = ["ボディカラー"];

  const needsManualCorrection = missingRequired.length > 0 || (conf !== null && conf < LOW_CONFIDENCE);

  return {
    model:          ctx.model,
    promptVersion:  ctx.promptVersion,
    confidence:     conf,
    missingRequired,
    warnings,
    processingMs:   ctx.processingMs,
    needsManualCorrection,
    manualRequired,
  };
}
