// Body-size auto-estimation from OCR vehicle data using the 3M method.
//
// 3M value = length_m + width_m + height_m (a rough surface-area proxy used for
// coating/PPF sizing). We map the 3M value onto the app's body-size classes
// (see src/lib/pricing/pricing-data.ts BODY_SIZES): SS/S/M/ML/L/LL/XL.
//
// Dimensions come from OCR when available; otherwise from an INTERNAL, APPROXIMATE
// maker/model dimension map. Unknown vehicles are NOT fabricated — the result is
// blank and the UI asks for manual input. The user can always override.
//
// Pure module (no DB / no "use server"). Safe for client or server import.

import type { VehicleRegistrationOcrResult } from "@/lib/vehicle-registration/vehicle-registration-types";

export const BODY_SIZE_KEYS = ["SS", "S", "M", "ML", "L", "LL", "XL"] as const;

export type BodySizeKey = (typeof BODY_SIZE_KEYS)[number];
export type BodySizeSource = "OCR" | "推測" | "手入力";
export type BodySizeRecommendationLevel = "recommended" | "adjacent" | "neutral";

export interface BodySizeEstimate {
  sizeKey: BodySizeKey | null;   // SS/S/M/ML/L/LL/XL, or null when unknown
  threeM:  number | null;        // 3M value (length+width+height, metres)
  source:  BodySizeSource | null;
  basis:   string;               // 推定根拠 (human-readable)
  adjacentSizeKeys: BodySizeKey[];
  requiresManualConfirmation: boolean;
}

interface Dim { l: number; w: number; h: number; label: string } // metres

// 3M → body-size class thresholds (approximate, monotonic). >= last max → XL.
const THREE_M_STEPS: { max: number; size: BodySizeKey }[] = [
  { max: 6.9, size: "SS" },
  { max: 7.3, size: "S"  },
  { max: 7.9, size: "M"  },
  { max: 8.3, size: "ML" },
  { max: 8.6, size: "L"  },
  { max: 8.9, size: "LL" },
];

export function classifyThreeM(threeM: number): BodySizeKey {
  if (!Number.isFinite(threeM) || threeM <= 0) {
    throw new RangeError("3M must be a positive finite value");
  }
  for (const s of THREE_M_STEPS) if (threeM < s.max) return s.size;
  return "XL";
}

export function adjacentBodySizeKeys(sizeKey: BodySizeKey | null): BodySizeKey[] {
  if (!sizeKey) return [];
  const index = BODY_SIZE_KEYS.indexOf(sizeKey);
  return [BODY_SIZE_KEYS[index - 1], BODY_SIZE_KEYS[index + 1]].filter(
    (value): value is BodySizeKey => value !== undefined,
  );
}

export function bodySizeRecommendationLevel(
  candidate: string,
  estimate: BodySizeEstimate | null,
): BodySizeRecommendationLevel {
  if (estimate?.sizeKey === candidate) return "recommended";
  if (estimate?.adjacentSizeKeys.includes(candidate as BodySizeKey)) return "adjacent";
  return "neutral";
}

// Internal APPROXIMATE dimension map (representative vehicle per maker/brand).
// Japanese keys match by substring; latin keys match case-insensitively.
const DIM_MAP: { keys: string[]; dim: Dim }[] = [
  // Kei / compact-leaning JP makers
  { keys: ["ダイハツ", "daihatsu"],              dim: { l: 3.40, w: 1.48, h: 1.70, label: "ダイハツ" } },
  { keys: ["スズキ", "suzuki"],                  dim: { l: 3.55, w: 1.48, h: 1.65, label: "スズキ" } },
  // Mainstream JP makers (mid-size representative)
  { keys: ["トヨタ", "toyota"],                  dim: { l: 4.60, w: 1.79, h: 1.50, label: "トヨタ" } },
  { keys: ["ホンダ", "honda"],                   dim: { l: 4.50, w: 1.78, h: 1.47, label: "ホンダ" } },
  { keys: ["日産", "ニッサン", "nissan"],        dim: { l: 4.60, w: 1.79, h: 1.50, label: "日産" } },
  { keys: ["マツダ", "mazda"],                   dim: { l: 4.60, w: 1.84, h: 1.44, label: "マツダ" } },
  { keys: ["スバル", "subaru"],                  dim: { l: 4.63, w: 1.82, h: 1.50, label: "スバル" } },
  { keys: ["三菱", "ミツビシ", "mitsubishi"],    dim: { l: 4.49, w: 1.81, h: 1.62, label: "三菱" } },
  { keys: ["レクサス", "lexus"],                 dim: { l: 4.90, w: 1.90, h: 1.45, label: "レクサス" } },
  // Import premium
  { keys: ["メルセデス", "ベンツ", "mercedes", "benz"], dim: { l: 4.90, w: 1.88, h: 1.45, label: "メルセデス" } },
  { keys: ["bmw", "ビーエムダブリュー"],         dim: { l: 4.70, w: 1.83, h: 1.44, label: "BMW" } },
  { keys: ["アウディ", "audi"],                  dim: { l: 4.75, w: 1.84, h: 1.42, label: "アウディ" } },
  { keys: ["フォルクスワーゲン", "vw", "volkswagen"], dim: { l: 4.26, w: 1.80, h: 1.46, label: "フォルクスワーゲン" } },
  { keys: ["ボルボ", "volvo"],                   dim: { l: 4.76, w: 1.90, h: 1.44, label: "ボルボ" } },
  { keys: ["ポルシェ", "porsche"],               dim: { l: 4.52, w: 1.90, h: 1.30, label: "ポルシェ" } },
  // Supercars / premium sports
  { keys: ["フェラーリ", "ferrari"],             dim: { l: 4.53, w: 1.94, h: 1.21, label: "フェラーリ" } },
  { keys: ["ランボルギーニ", "lamborghini"],     dim: { l: 4.54, w: 2.03, h: 1.16, label: "ランボルギーニ" } },
  { keys: ["マクラーレン", "mclaren"],           dim: { l: 4.54, w: 2.09, h: 1.20, label: "マクラーレン" } },
  { keys: ["アストンマーティン", "aston"],       dim: { l: 4.70, w: 1.94, h: 1.28, label: "アストンマーティン" } },
  { keys: ["マセラティ", "maserati"],            dim: { l: 4.75, w: 1.95, h: 1.35, label: "マセラティ" } },
  { keys: ["ベントレー", "bentley"],             dim: { l: 5.30, w: 1.96, h: 1.49, label: "ベントレー" } },
  { keys: ["ロールスロイス", "rolls"],           dim: { l: 5.40, w: 2.00, h: 1.55, label: "ロールスロイス" } },
  // Large SUV
  { keys: ["レンジローバー", "ランドローバー", "land rover", "range rover"], dim: { l: 5.00, w: 2.00, h: 1.87, label: "ランドローバー" } },
  { keys: ["ジープ", "jeep"],                    dim: { l: 4.83, w: 1.89, h: 1.70, label: "ジープ" } },
  { keys: ["ハマー", "hummer"],                  dim: { l: 5.20, w: 2.20, h: 1.90, label: "ハマー" } },
];

function round2(n: number): number { return Math.round(n * 100) / 100; }

export interface EstimateBodySizeInput {
  maker?:       string | null;
  vehicleName?: string | null;
  model?:       string | null;
  grade?:       string | null;
  year?:        string | null;
  lengthM?:     number | null;
  widthM?:      number | null;
  heightM?:     number | null;
  /** OCR confidence, normalized to 0..1. Missing/low confidence remains manual-review only. */
  dimensionConfidence?: number | null;
}

function isPositiveFinite(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function unknownEstimate(basis: string): BodySizeEstimate {
  return {
    sizeKey: null,
    threeM: null,
    source: null,
    basis,
    adjacentSizeKeys: [],
    requiresManualConfirmation: true,
  };
}

function buildEstimate(
  sizeKey: BodySizeKey,
  threeM: number,
  source: BodySizeSource,
  basis: string,
): BodySizeEstimate {
  return {
    sizeKey,
    threeM,
    source,
    basis,
    adjacentSizeKeys: adjacentBodySizeKeys(sizeKey),
    // A recommendation never becomes the stored physical body size until the operator selects it.
    requiresManualConfirmation: true,
  };
}

/**
 * Estimate the body-size class from OCR vehicle data using the 3M method.
 * Never fabricates: unknown vehicles return { sizeKey: null } with a manual-input prompt.
 */
export function estimateBodySize(input: EstimateBodySizeInput): BodySizeEstimate {
  // 1) Explicit dimensions (from OCR) take priority.
  const { lengthM, widthM, heightM } = input;
  const suppliedDimensions = [lengthM, widthM, heightM];
  const hasAnyDimension = suppliedDimensions.some((value) => value != null);
  const hasAllValidDimensions = isPositiveFinite(lengthM)
    && isPositiveFinite(widthM)
    && isPositiveFinite(heightM);

  if (hasAnyDimension && !hasAllValidDimensions) {
    return unknownEstimate("車検証の長さ・幅・高さを確認し、3項目すべてを正しいメートル値で入力してください");
  }

  if (hasAllValidDimensions) {
    const threeM = round2(lengthM + widthM + heightM);
    const confidence = input.dimensionConfidence;
    const confidenceNote = confidence == null || confidence < 0.8
      ? "・OCR信頼度未確認のため目視確認が必要"
      : "";
    const sizeKey = classifyThreeM(threeM);
    return buildEstimate(sizeKey, threeM, "OCR", `OCR寸法から算出（3M=${threeM}m）${confidenceNote}`);
  }

  // 2) Look up representative dimensions from the internal map (maker/model text).
  const text  = [input.maker, input.vehicleName, input.model].filter(Boolean).join(" ");
  const lower = text.toLowerCase();
  const hit = DIM_MAP.find((e) =>
    e.keys.some((k) => (/[a-z]/.test(k) ? lower.includes(k) : text.includes(k))),
  );
  if (hit) {
    const threeM = round2(hit.dim.l + hit.dim.w + hit.dim.h);
    const sizeKey = classifyThreeM(threeM);
    return buildEstimate(
      sizeKey,
      threeM,
      "推測",
      `${hit.dim.label}の代表寸法による参考候補（3M=${threeM}m）・車種固有寸法ではないため確認が必要`,
    );
  }

  // 3) Unknown — do not fabricate.
  return unknownEstimate("サイズを手入力してください");
}

/** Convert canonical OCR millimetres to metres, then use the one shared 3M contract. */
export function estimateBodySizeFromVehicleRegistrationOcr(
  ocr: Partial<VehicleRegistrationOcrResult>,
): BodySizeEstimate {
  return estimateBodySize({
    maker: ocr.maker,
    vehicleName: ocr.vehicle_name,
    model: ocr.model,
    grade: ocr.grade,
    lengthM: ocr.length_mm == null ? null : ocr.length_mm / 1000,
    widthM: ocr.width_mm == null ? null : ocr.width_mm / 1000,
    heightM: ocr.height_mm == null ? null : ocr.height_mm / 1000,
    dimensionConfidence: ocr.dimension_confidence,
  });
}
