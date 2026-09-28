// Vehicle Registration AI OCR — OpenAI Vision analysis (image + PDF).
// Server-side only — imported only from "use server" modules. API key never exposed.
// E9.1: model defaults to the approved gpt-4.1-mini and is overridable via env.
//
// Key ownership: this is a GYEON-managed feature. The key is resolved server-side
// via getGyeonManagedApiKey() (OPENAI_API_KEY) — dealers never supply a key here.
// See: docs/AI_API_OWNERSHIP_POLICY.md

import { VehicleRegistrationOcrResult } from "./vehicle-registration-types";
import { analyzeOcrCustomer, resolveCustomer } from "./ocr-customer-mapping";
import { normalizeVehicleFields } from "./vehicle-normalize";
import { buildOcrQualityReport, resolveVehicleIdentity, type OcrQualityReport } from "./ocr-quality";
import {
  applyPdfTextLayerCertificateFields,
  extractCertificateCodesFromPdfBase64,
  type PdfTextLayerExtraction,
} from "./pdf-text-layer";
import { getGyeonManagedApiKey } from "@/lib/ai/gyeon-managed-key";
import { OCR_MODEL, OCR_TEMPERATURE, OCR_MAX_TOKENS, OCR_PROMPT_VERSION } from "@/lib/ai/ocr-config";
import { addressWithoutLeadingPostal, normalizeJapanesePostalCode, postalCodeFromAddress } from "./postal-normalization";
import { lookupJapanPostPostalCode } from "@/lib/geo/japan-post-postal-resolver";

const OCR_PROVIDER   = "openai";
const OCR_TIMEOUT_MS = 55_000; // 55s — OpenAI cold-start can take ~30s; give headroom

const EXTRACTION_PROMPT = `あなたは日本の車検証（自動車検査証）を読み取るAIアシスタントです。
提供された画像から以下の項目を抽出し、厳密にJSONのみで返してください。

抽出ルール:
- 画像に明確に記載されている値のみ返す
- 不明・読み取れない・不鮮明な項目は空文字列 "" を返す
- 値を推測・補完・創作しないこと
- 日付はYYYY-MM-DD形式に正規化
- first_registration_date（初度登録年月）と registration_date（登録年月日）は別項目。統合しないこと
  - first_registration_date: 「初度登録年月」＝最初に登録された年月（YYYY-MM）。年式・車齢の推定に使用
  - registration_date: 「登録年月日」＝現在の登録日（YYYY-MM-DD）。新規/中古/名義変更など現在の登録時期
- ナンバープレートは region/class/kana/number の4項目に分割
- 所有者(owner)と使用者(user)は必ず別項目として抽出する（両方を保持）
- 郵便番号は owner_postal_code / user_postal_code に「000-0000」の7桁で分離して返す
- owner_address / user_address には郵便番号を含めない
- 7桁全てが明確に読めない場合は郵便番号を空文字とし、推測・補完しない
- customer_type: 顧客が個人なら "individual"、法人・会社・店舗なら "corporation"、不明なら "unknown"
- owner_user_separated: 所有者と使用者が明らかに異なる場合 "true"、同一なら "false"、不明なら "unknown"
- length_mm / width_mm / height_mm: 車検証に記載された長さ・幅・高さをmm単位の数値で返す。不鮮明・欠損時は null。単位換算以外の推測は禁止
- dimension_confidence: 長さ・幅・高さ3項目の読み取り品質を0〜1で評価。1項目でも不鮮明なら0.79以下
- 法人名（株式会社・有限会社など）は姓名に分割しないこと
- vehicle_name: 車検証「車名」欄の記載そのまま（法定車名＝メーカー名。例: トヨタ）。通称名やグレードは車検証に記載がないため絶対に創作しない
- maker: 「車名」欄から判定したメーカー名
- model: 車検証「型式」欄の値のみ（例: DBA-XXX999 のようにハイフンを含む形式。軽自動車も同じ）。「原動機の型式」や「型式指定番号」を入れないこと
- engine_model: 「原動機の型式」欄の値（例: X99X のような短い英数字）。model や grade など他の項目に入れないこと
- model_code: 「型式指定番号」欄の数字のみ。型式（英字とハイフンを含む値）を入れないこと
- classification_number: 「類別区分番号」欄の数字のみ。model_code と classification_number はナンバープレートの分類番号(license_plate_class)とは別項目。記載がなければ空文字
- confidence は全体的な読み取り品質を0〜1で評価

出力JSONスキーマ（このキーのみ、説明文なし）:
{
  "owner_name": "",
  "user_name": "",
  "owner_name_kana": "",
  "user_name_kana": "",
  "owner_postal_code": "",
  "user_postal_code": "",
  "owner_address": "",
  "user_address": "",
  "vehicle_name": "",
  "maker": "",
  "model": "",
  "engine_model": "",
  "model_code": "",
  "classification_number": "",
  "chassis_number": "",
  "license_plate_region": "",
  "license_plate_class": "",
  "license_plate_kana": "",
  "license_plate_number": "",
  "first_registration_date": "",
  "registration_date": "",
  "inspection_expiry_date": "",
  "vehicle_type": "",
  "use_type": "",
  "private_or_business": "",
  "body_shape": "",
  "fuel_type": "",
  "displacement": "",
  "length_mm": null,
  "width_mm": null,
  "height_mm": null,
  "dimension_confidence": 0.0,
  "color": "",
  "notes": "",
  "customer_type": "",
  "owner_user_separated": "",
  "confidence": 0.0
}`;

// ─── Typed error codes ────────────────────────────────────────────────────────

export type OcrErrorCode =
  | "OPENAI_API_KEY_MISSING"
  | "TIMEOUT"
  | "CONNECT_ERROR"
  | "OPENAI_AUTH_ERROR"
  | "OPENAI_RATE_LIMIT"
  | "OPENAI_SERVER_ERROR"
  | "EMPTY_RESPONSE"
  | "PARSE_ERROR"
  | "UNKNOWN_ERROR";

// Token usage surfaced from the OpenAI response for AI usage logging.
export interface OcrUsage {
  input:  number | null;
  output: number | null;
  total:  number | null;
}

// These codes warrant a single transparent retry on the server side.
const RETRYABLE_CODES: OcrErrorCode[] = ["TIMEOUT", "CONNECT_ERROR", "OPENAI_SERVER_ERROR"];

// The ONLY keys accepted from the AI. Everything else the model emits is discarded — in particular the
// result-internal keys the server itself writes later (vehicle_identity_notices, model_needs_confirmation,
// model_text_layer): 型式 provenance can never be claimed by AI output, only established by pdf-text-layer.ts.
const STRING_FIELDS: Array<keyof VehicleRegistrationOcrResult> = [
  "owner_name", "user_name", "owner_name_kana", "user_name_kana",
  "owner_postal_code", "user_postal_code", "owner_address", "user_address",
  "vehicle_name", "maker", "model", "grade", "model_code", "classification_number", "engine_model", "chassis_number",
  "license_plate_region", "license_plate_class", "license_plate_kana", "license_plate_number",
  "first_registration_date", "registration_date", "inspection_expiry_date",
  "vehicle_type", "use_type", "private_or_business", "body_shape",
  "fuel_type", "displacement", "color", "notes",
  "customer_type", "owner_user_separated",
];

const DIMENSION_FIELDS = ["length_mm", "width_mm", "height_mm"] as const;

function sanitizeDimensionMm(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  const rounded = Math.round(value);
  // Fail closed on clearly non-vehicle values or unit mistakes such as metres supplied as 4.6.
  if (rounded < 500 || rounded > 15_000) return undefined;
  return rounded;
}

/** Pure sanitizer exported for source-contract tests; performs no network or persistence action. */
export function sanitizeVehicleRegistrationOcrResult(
  parsed: VehicleRegistrationOcrResult,
): VehicleRegistrationOcrResult {
  const sanitized: VehicleRegistrationOcrResult = {};
  for (const key of STRING_FIELDS) {
    const val = parsed[key];
    if (typeof val === "string" && val.trim() !== "") {
      (sanitized as Record<string, unknown>)[key] = val.trim();
    }
  }
  for (const party of ["owner", "user"] as const) {
    const postalKey = `${party}_postal_code` as const;
    const addressKey = `${party}_address` as const;
    const address = sanitized[addressKey];
    const postal = normalizeJapanesePostalCode(sanitized[postalKey]) ?? postalCodeFromAddress(address);
    if (postal !== null) sanitized[postalKey] = postal;
    else delete sanitized[postalKey];
    const cleanAddress = addressWithoutLeadingPostal(address);
    if (cleanAddress !== null) sanitized[addressKey] = cleanAddress;
    else delete sanitized[addressKey];
  }
  for (const key of DIMENSION_FIELDS) {
    const value = sanitizeDimensionMm(parsed[key]);
    if (value !== undefined) sanitized[key] = value;
  }
  const rawConf = parsed.confidence;
  if (typeof rawConf === "number" && rawConf >= 0 && rawConf <= 1) {
    sanitized.confidence = rawConf;
  }
  const dimensionConfidence = parsed.dimension_confidence;
  if (
    typeof dimensionConfidence === "number"
    && dimensionConfidence >= 0
    && dimensionConfidence <= 1
  ) {
    sanitized.dimension_confidence = dimensionConfidence;
  }
  return sanitized;
}

/**
 * Pure vehicle-identity policy applied after sanitizing (exported for source-contract tests).
 * - The 車検証「車名」欄 is the LEGAL name (the manufacturer). The commercial model name and グレード
 *   are not printed on the certificate, so both are ALWAYS blank here. The operator may type them in
 *   review; downstream a blank never overwrites an operator-entered value.
 * - `model` is the certificate「型式」欄 only; 原動機の型式 / 型式指定番号 / 類別区分番号 are kept apart by
 *   resolveVehicleIdentity(), which blanks ambiguous values with an operator-visible notice instead
 *   of guessing (see ocr-quality.ts).
 * - ボディカラー is manual-required — the AI must never auto-fill it.
 */
export function applyVehicleIdentityPolicy(
  sanitized: VehicleRegistrationOcrResult,
  opts: { trustedModelShape?: boolean } = {},
): VehicleRegistrationOcrResult {
  // Deterministic maker detection (the 車名欄 usually carries the maker); model/grade output of the
  // normalizer is deliberately discarded — never derived from 車名 tokens.
  const norm = normalizeVehicleFields({ maker: sanitized.maker, vehicleName: sanitized.vehicle_name });
  if (norm.maker) sanitized.maker = norm.maker;
  else delete sanitized.maker;
  delete sanitized.vehicle_name; // 通称名: never from OCR
  delete sanitized.grade;        // グレード: never from OCR (an engine type must never land here)

  const resolved = resolveVehicleIdentity(sanitized, {
    ambiguousGrade: "blank",
    trustedModelShape: opts.trustedModelShape === true,
  }).result;
  for (const key of Object.keys(sanitized) as Array<keyof VehicleRegistrationOcrResult>) {
    if (!(key in resolved)) delete sanitized[key];
  }
  Object.assign(sanitized, resolved);

  delete (sanitized as Record<string, unknown>).color;
  return sanitized;
}

/**
 * A 車検証 usually prints an address but not a postal code. Complete OCR evidence wins; otherwise
 * resolve the SAME party address against the bundled official Japan Post map. Unknown or ambiguous
 * prefixes remain blank, so a stray fragment such as `〒523-` can never be completed by guesswork.
 */
export function enrichPostalCodesFromOfficialAddressData(
  result: VehicleRegistrationOcrResult,
): VehicleRegistrationOcrResult {
  for (const party of ["owner", "user"] as const) {
    const postalKey = `${party}_postal_code` as const;
    const addressKey = `${party}_address` as const;
    if (normalizeJapanesePostalCode(result[postalKey]) !== null) continue;
    const resolved = lookupJapanPostPostalCode(result[addressKey]);
    if (resolved !== null) result[postalKey] = resolved;
  }
  return result;
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

// ─── Single OpenAI call with timeout ─────────────────────────────────────────

async function callOpenAI(
  fileBase64: string,
  mimeType: string,
  apiKey: string,
  pdfTextLayer: PdfTextLayerExtraction | null,
): Promise<
  | { result: VehicleRegistrationOcrResult; provider: string; model: string; usage: OcrUsage; promptVersion: string; quality: OcrQualityReport }
  | { error: OcrErrorCode }
> {
  const controller = new AbortController();
  const timeoutId  = setTimeout(() => controller.abort(), OCR_TIMEOUT_MS);

  // E9.1: PDFs are sent as a document part; images keep the proven image_url path.
  const isPdf = mimeType === "application/pdf";
  const filePart: Record<string, unknown> = isPdf
    ? { type: "file", file: { filename: "document.pdf", file_data: `data:application/pdf;base64,${fileBase64}` } }
    : { type: "image_url", image_url: { url: `data:${mimeType};base64,${fileBase64}`, detail: "high" } };

  const startedAt = Date.now();
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method:  "POST",
      signal:  controller.signal,
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model:           OCR_MODEL,
        temperature:     OCR_TEMPERATURE,  // 0 → deterministic
        max_tokens:      OCR_MAX_TOKENS,
        messages: [
          {
            role:    "user",
            content: [
              { type: "text", text: EXTRACTION_PROMPT },
              filePart,
            ],
          },
        ],
        response_format: { type: "json_object" }, // JSON-only (no free text)
      }),
    });

    clearTimeout(timeoutId);
    const processingMs = Date.now() - startedAt;
    console.log(`[OCR] run — model=${OCR_MODEL} promptVersion=${OCR_PROMPT_VERSION} temp=${OCR_TEMPERATURE} ms=${processingMs}`);

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      console.error("[OCR] OpenAI API error:", response.status, body.slice(0, 200));
      if (response.status === 401) return { error: "OPENAI_AUTH_ERROR"   };
      if (response.status === 429) return { error: "OPENAI_RATE_LIMIT"   };
      if (response.status >= 500)  return { error: "OPENAI_SERVER_ERROR" };
      return { error: "UNKNOWN_ERROR" };
    }

    const json    = await response.json();
    const content: string = json.choices?.[0]?.message?.content ?? "{}";

    const rawUsage = json.usage as { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | undefined;
    const usage: OcrUsage = {
      input:  typeof rawUsage?.prompt_tokens     === "number" ? rawUsage.prompt_tokens     : null,
      output: typeof rawUsage?.completion_tokens === "number" ? rawUsage.completion_tokens : null,
      total:  typeof rawUsage?.total_tokens      === "number" ? rawUsage.total_tokens      : null,
    };

    let parsed: VehicleRegistrationOcrResult;
    try {
      parsed = JSON.parse(content) as VehicleRegistrationOcrResult;
    } catch {
      console.error("[OCR] Failed to parse JSON:", content.slice(0, 300));
      return { error: "PARSE_ERROR" };
    }

    // Build sanitized result — non-empty strings plus strictly validated mm dimensions/confidence.
    const sanitized = enrichPostalCodesFromOfficialAddressData(
      sanitizeVehicleRegistrationOcrResult(parsed),
    );

    // If no string field was extracted, treat as unreadable image
    const hasData = STRING_FIELDS.some(k => k in sanitized) || DIMENSION_FIELDS.some(k => k in sanitized);
    if (!hasData) {
      console.error("[OCR] Empty result — model extracted no fields. Image may not be a 車検証.");
      return { error: "EMPTY_RESPONSE" };
    }

    // Selectable PDF: the label-anchored text layer (page 1) overrides ONLY the four certificate
    // codes (型式 / 原動機の型式 / 型式指定番号 / 類別区分番号). No text layer → no field changes here;
    // only a (never expected) pre-existing model_text_layer claim is discarded, so trust fails closed.
    const textLayer = applyPdfTextLayerCertificateFields(sanitized, pdfTextLayer);

    // Deterministic vehicle-identity policy: maker from the 車名欄, 通称名/グレード always blank,
    // 型式 = certificate 型式 column only, ボディカラー manual-only.
    applyVehicleIdentityPolicy(sanitized, { trustedModelShape: textLayer.trustedModel });

    // Derive the customer mapping (owner/user rule). Owner AND user raw fields are
    // preserved above; this only records the recommended candidate + flags.
    const analysis = analyzeOcrCustomer(sanitized);
    sanitized.owner_user_separated = analysis.ownerUserSeparated ? "true" : "false";
    const resolved = resolveCustomer(sanitized, analysis.recommendedSource);
    if (resolved.name)    sanitized.customer_candidate_name    = resolved.name;
    if (resolved.postal)  sanitized.customer_candidate_postal_code = resolved.postal;
    if (resolved.address) sanitized.customer_candidate_address = resolved.address;
    sanitized.customer_type = resolved.customerType;

    // OCR quality report (model / prompt version / missing required / warnings / time).
    const quality = buildOcrQualityReport(sanitized, {
      model: OCR_MODEL, promptVersion: OCR_PROMPT_VERSION, processingMs,
    });
    console.log(`[OCR] quality — confidence=${quality.confidence ?? "n/a"} missing=[${quality.missingRequired.join(",")}] needsManual=${quality.needsManualCorrection}`);

    return { result: sanitized, provider: OCR_PROVIDER, model: OCR_MODEL, usage, promptVersion: OCR_PROMPT_VERSION, quality };

  } catch (err) {
    clearTimeout(timeoutId);
    if (err instanceof Error && err.name === "AbortError") {
      console.error("[OCR] Request timed out after", OCR_TIMEOUT_MS / 1000, "s");
      return { error: "TIMEOUT" };
    }
    console.error("[OCR] Network error:", err);
    return { error: "CONNECT_ERROR" };
  }
}

// ─── Public API — 1 transparent server-side retry on transient errors ─────────

export async function analyzeVehicleRegistrationImage(
  imageBase64: string,
  mimeType: string = "image/jpeg",
): Promise<
  | { result: VehicleRegistrationOcrResult; provider: string; model: string; usage: OcrUsage; promptVersion: string; quality: OcrQualityReport }
  | { error: OcrErrorCode }
> {
  const keyResult = await getGyeonManagedApiKey();
  if (!keyResult.ok) {
    console.error("[OCR] GYEON-managed OpenAI key not configured (AI Center DB nor OPENAI_API_KEY)");
    return { error: "OPENAI_API_KEY_MISSING" };
  }
  const apiKey = keyResult.apiKey;

  // Deterministic PDF text-layer pass (page 1, bounded). Runs once per request, before the AI call,
  // and only for PDFs. Any failure is fail-closed: status without fields → AI path unchanged.
  let pdfTextLayer: PdfTextLayerExtraction | null = null;
  if (mimeType === "application/pdf") {
    pdfTextLayer = await extractCertificateCodesFromPdfBase64(imageBase64);
    // Field NAMES only — values are never logged.
    console.log(`[OCR] pdf-text-layer status=${pdfTextLayer.status} fields=[${Object.keys(pdfTextLayer.fields).join(",")}] lines=${pdfTextLayer.lineCount}`);
  }

  const first = await callOpenAI(imageBase64, mimeType, apiKey, pdfTextLayer);

  if ("error" in first && RETRYABLE_CODES.includes(first.error)) {
    console.log("[OCR] Transient error:", first.error, "— retrying once in 2 s …");
    await sleep(2_000);
    const second = await callOpenAI(imageBase64, mimeType, apiKey, pdfTextLayer);
    console.log("[OCR] Retry result:", "error" in second ? second.error : "success");
    return second;
  }

  return first;
}
