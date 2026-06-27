// PHASE67: Vehicle Registration AI OCR — GPT-4o-mini Vision Analysis
// Server-side only — imported only from "use server" modules. API key never exposed.

import { VehicleRegistrationOcrResult } from "./vehicle-registration-types";

const OCR_PROVIDER   = "openai";
const OCR_MODEL      = "gpt-4o-mini";
const OCR_TIMEOUT_MS = 55_000; // 55s — OpenAI cold-start can take ~30s; give headroom

const EXTRACTION_PROMPT = `あなたは日本の車検証（自動車検査証）を読み取るAIアシスタントです。
提供された画像から以下の項目を抽出し、厳密にJSONのみで返してください。

抽出ルール:
- 画像に明確に記載されている値のみ返す
- 不明・読み取れない・不鮮明な項目は空文字列 "" を返す
- 値を推測・補完・創作しないこと
- 日付はYYYY-MM-DD形式に正規化（初年度登録はYYYY-MM）
- ナンバープレートは region/class/kana/number の4項目に分割
- confidence は全体的な読み取り品質を0〜1で評価

出力JSONスキーマ（このキーのみ、説明文なし）:
{
  "owner_name": "",
  "user_name": "",
  "owner_address": "",
  "user_address": "",
  "vehicle_name": "",
  "maker": "",
  "model": "",
  "grade": "",
  "model_code": "",
  "chassis_number": "",
  "license_plate_region": "",
  "license_plate_class": "",
  "license_plate_kana": "",
  "license_plate_number": "",
  "first_registration_date": "",
  "inspection_expiry_date": "",
  "vehicle_type": "",
  "use_type": "",
  "private_or_business": "",
  "body_shape": "",
  "fuel_type": "",
  "displacement": "",
  "color": "",
  "notes": "",
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

// These codes warrant a single transparent retry on the server side.
const RETRYABLE_CODES: OcrErrorCode[] = ["TIMEOUT", "CONNECT_ERROR", "OPENAI_SERVER_ERROR"];

const STRING_FIELDS: Array<keyof VehicleRegistrationOcrResult> = [
  "owner_name", "user_name", "owner_address", "user_address",
  "vehicle_name", "maker", "model", "grade", "model_code", "chassis_number",
  "license_plate_region", "license_plate_class", "license_plate_kana", "license_plate_number",
  "first_registration_date", "inspection_expiry_date",
  "vehicle_type", "use_type", "private_or_business", "body_shape",
  "fuel_type", "displacement", "color", "notes",
];

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

// ─── Single OpenAI call with timeout ─────────────────────────────────────────

async function callOpenAI(
  imageBase64: string,
  mimeType: string,
  apiKey: string,
): Promise<
  | { result: VehicleRegistrationOcrResult; provider: string; model: string }
  | { error: OcrErrorCode }
> {
  const controller = new AbortController();
  const timeoutId  = setTimeout(() => controller.abort(), OCR_TIMEOUT_MS);

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method:  "POST",
      signal:  controller.signal,
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model:      OCR_MODEL,
        max_tokens: 1000,
        messages: [
          {
            role:    "user",
            content: [
              { type: "text", text: EXTRACTION_PROMPT },
              {
                type:      "image_url",
                image_url: {
                  url:    `data:${mimeType};base64,${imageBase64}`,
                  detail: "high",
                },
              },
            ],
          },
        ],
        response_format: { type: "json_object" },
      }),
    });

    clearTimeout(timeoutId);

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

    let parsed: VehicleRegistrationOcrResult;
    try {
      parsed = JSON.parse(content) as VehicleRegistrationOcrResult;
    } catch {
      console.error("[OCR] Failed to parse JSON:", content.slice(0, 300));
      return { error: "PARSE_ERROR" };
    }

    // Build sanitized result — only non-empty strings and valid confidence
    const sanitized: VehicleRegistrationOcrResult = {};
    for (const key of STRING_FIELDS) {
      const val = parsed[key];
      if (typeof val === "string" && val.trim() !== "") {
        (sanitized as Record<string, unknown>)[key] = val.trim();
      }
    }
    const rawConf = parsed.confidence;
    if (typeof rawConf === "number" && rawConf >= 0 && rawConf <= 1) {
      sanitized.confidence = rawConf;
    }

    // If no string field was extracted, treat as unreadable image
    const hasData = STRING_FIELDS.some(k => k in sanitized);
    if (!hasData) {
      console.error("[OCR] Empty result — model extracted no fields. Image may not be a 車検証.");
      return { error: "EMPTY_RESPONSE" };
    }

    return { result: sanitized, provider: OCR_PROVIDER, model: OCR_MODEL };

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
  | { result: VehicleRegistrationOcrResult; provider: string; model: string }
  | { error: OcrErrorCode }
> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error("[OCR] OPENAI_API_KEY is not set");
    return { error: "OPENAI_API_KEY_MISSING" };
  }

  const first = await callOpenAI(imageBase64, mimeType, apiKey);

  if ("error" in first && RETRYABLE_CODES.includes(first.error)) {
    console.log("[OCR] Transient error:", first.error, "— retrying once in 2 s …");
    await sleep(2_000);
    const second = await callOpenAI(imageBase64, mimeType, apiKey);
    console.log("[OCR] Retry result:", "error" in second ? second.error : "success");
    return second;
  }

  return first;
}
