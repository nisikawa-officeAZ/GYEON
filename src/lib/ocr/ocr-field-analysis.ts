// Phase 2 Sprint 4 — OCR quality & missing-field analysis (pure foundation).
//
// Provides confidence classification and "important field missing" detection for
// a vehicle registration OCR result. The OCR model returns a single overall
// confidence (0–1), so per-field confidence is not available; instead we flag
// IMPORTANT logical fields that the model failed to extract, so the UI can ask
// the user to fill them in before saving.
//
// Pure functions only (no schema, no I/O) — safe for server and client.
// Field importance is generic vehicle-registration data, not Japan-specific
// business logic.

import type { VehicleRegistrationOcrResult } from "@/lib/vehicle-registration/vehicle-registration-types";

export type ConfidenceLevel = "high" | "medium" | "low" | "none";

export interface OcrQuality {
  confidence:      number | null;
  level:           ConfidenceLevel;
  missingCustomer: string[];  // human-readable labels of important customer fields not extracted
  missingVehicle:  string[];  // human-readable labels of important vehicle fields not extracted
  hasMissing:      boolean;
}

function present(v: string | undefined): boolean {
  return typeof v === "string" && v.trim() !== "";
}

function confidenceLevel(confidence: number | null): ConfidenceLevel {
  if (confidence == null) return "none";
  if (confidence >= 0.8)  return "high";
  if (confidence >= 0.5)  return "medium";
  return "low";
}

export function analyzeOcrQuality(ocr: VehicleRegistrationOcrResult): OcrQuality {
  const confidence = typeof ocr.confidence === "number" ? ocr.confidence : null;

  const missingCustomer: string[] = [];
  if (!present(ocr.user_name)    && !present(ocr.owner_name))    missingCustomer.push("氏名");
  if (!present(ocr.user_address) && !present(ocr.owner_address)) missingCustomer.push("住所");

  const missingVehicle: string[] = [];
  if (!present(ocr.maker))          missingVehicle.push("メーカー");
  if (!present(ocr.vehicle_name) && !present(ocr.model)) missingVehicle.push("車名");
  if (!present(ocr.chassis_number)) missingVehicle.push("車台番号");

  const hasPlate =
    present(ocr.license_plate_region) || present(ocr.license_plate_class) ||
    present(ocr.license_plate_kana)   || present(ocr.license_plate_number);
  if (!hasPlate) missingVehicle.push("ナンバー");

  if (!present(ocr.first_registration_date)) missingVehicle.push("初年度登録");
  if (!present(ocr.inspection_expiry_date))  missingVehicle.push("車検満了日");

  return {
    confidence,
    level: confidenceLevel(confidence),
    missingCustomer,
    missingVehicle,
    hasMissing: missingCustomer.length > 0 || missingVehicle.length > 0,
  };
}
