// PHASE67: Vehicle Registration AI OCR — GPT-4o-mini Vision Analysis
// Server-side only utility — imported only from "use server" modules.
// API key is never exposed to client.

import { VehicleRegistrationOcrResult } from "./vehicle-registration-types";

const OCR_PROVIDER = "openai";
const OCR_MODEL    = "gpt-4o-mini";

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

export async function analyzeVehicleRegistrationImage(
  imageBase64: string,
  mimeType: string = "image/jpeg",
): Promise<{ result: VehicleRegistrationOcrResult; provider: string; model: string } | { error: string }> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return { error: "OPENAI_API_KEY_MISSING" };
  }

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method:  "POST",
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
              {
                type: "text",
                text: EXTRACTION_PROMPT,
              },
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

    if (!response.ok) {
      const body = await response.text();
      console.error("[OCR] OpenAI API error:", response.status, body);
      return { error: `OpenAI API error: ${response.status}` };
    }

    const json = await response.json();
    const content: string = json.choices?.[0]?.message?.content ?? "{}";

    let parsed: VehicleRegistrationOcrResult;
    try {
      parsed = JSON.parse(content) as VehicleRegistrationOcrResult;
    } catch {
      console.error("[OCR] Failed to parse JSON response:", content);
      return { error: "OCR応答の解析に失敗しました" };
    }

    // Sanitize: ensure all string fields are strings (no nulls leaking through)
    const sanitized: VehicleRegistrationOcrResult = {};
    const stringFields: Array<keyof VehicleRegistrationOcrResult> = [
      "owner_name", "user_name", "owner_address", "user_address",
      "vehicle_name", "maker", "model", "grade", "model_code", "chassis_number",
      "license_plate_region", "license_plate_class", "license_plate_kana", "license_plate_number",
      "first_registration_date", "inspection_expiry_date",
      "vehicle_type", "use_type", "private_or_business", "body_shape", "fuel_type",
      "displacement", "color", "notes",
    ];

    for (const key of stringFields) {
      const val = parsed[key];
      if (typeof val === "string" && val.trim() !== "") {
        (sanitized as Record<string, unknown>)[key] = val.trim();
      }
    }

    const rawConf = parsed.confidence;
    if (typeof rawConf === "number" && rawConf >= 0 && rawConf <= 1) {
      sanitized.confidence = rawConf;
    }

    return { result: sanitized, provider: OCR_PROVIDER, model: OCR_MODEL };
  } catch (err) {
    console.error("[OCR] Unexpected error:", err);
    return { error: "OCR処理中に予期しないエラーが発生しました" };
  }
}
