// RC-02: OCR result → vehicle form state mapper
//
// Maps vehicle registration certificate (車検証) OCR output to vehicle fields.
// Fields not present in vehicle registration (displacement, fuel_type etc.)
// are captured for display/review but may not yet be persisted to vehicles table.
// User must review all fields before registration.

import type { VehicleRegistrationOcrResult } from "@/lib/vehicle-registration/vehicle-registration-types";

// ─── Vehicle form state ───────────────────────────────────────────────────────

export interface VehicleFormState {
  maker:                  string;
  model:                  string;
  grade:                  string;
  model_code:             string;  // 型式指定番号
  year:                   string;  // 年式 (4-digit year from first_registration_date)
  color:                  string;
  plate_number:           string;
  vin:                    string;  // 車台番号
  fuel_type:              string;  // 燃料種類
  displacement:           string;  // 排気量
  registration_date:      string;  // 初年度登録 (YYYY-MM)
  body_size:              string;
  inspection_expiry_date: string;
  notes:                  string;
}

export const EMPTY_VEHICLE_FORM: VehicleFormState = {
  maker:                  "",
  model:                  "",
  grade:                  "",
  model_code:             "",
  year:                   "",
  color:                  "",
  plate_number:           "",
  vin:                    "",
  fuel_type:              "",
  displacement:           "",
  registration_date:      "",
  body_size:              "",
  inspection_expiry_date: "",
  notes:                  "",
};

// ─── Plate number builder ─────────────────────────────────────────────────────

function buildPlateNumber(ocr: Partial<VehicleRegistrationOcrResult>): string {
  const parts = [
    ocr.license_plate_region,
    ocr.license_plate_class,
    ocr.license_plate_kana,
    ocr.license_plate_number,
  ].filter(Boolean);
  return parts.join(" ");
}

// ─── Main mapper ──────────────────────────────────────────────────────────────

export function mapOcrToVehicle(
  ocr: Partial<VehicleRegistrationOcrResult>,
): Partial<VehicleFormState> {
  const result: Partial<VehicleFormState> = {};

  if (ocr.maker)                  result.maker       = ocr.maker;
  // Prefer 車名 (vehicle_name); fall back to 型式 (model) so the model field is
  // not left empty when only the type code was read.
  if (ocr.vehicle_name)           result.model       = ocr.vehicle_name;
  else if (ocr.model)             result.model       = ocr.model;
  if (ocr.grade)                  result.grade       = ocr.grade;
  if (ocr.model_code)             result.model_code  = ocr.model_code;
  if (ocr.color)                  result.color       = ocr.color;
  if (ocr.chassis_number)         result.vin         = ocr.chassis_number;
  if (ocr.fuel_type)              result.fuel_type   = ocr.fuel_type;
  if (ocr.displacement)           result.displacement = ocr.displacement;
  if (ocr.inspection_expiry_date) result.inspection_expiry_date = ocr.inspection_expiry_date;

  if (ocr.first_registration_date) {
    result.registration_date = ocr.first_registration_date;
    // Derive 4-digit year for the year field
    const year = ocr.first_registration_date.slice(0, 4);
    if (year) result.year = year;
  }

  const plate = buildPlateNumber(ocr);
  if (plate) result.plate_number = plate;

  return result;
}
