// RC-02: OCR result → vehicle form state mapper
//
// Maps vehicle registration certificate (車検証) OCR output to vehicle fields.
// Fields not present in vehicle registration (displacement, fuel_type etc.)
// are captured for display/review but may not yet be persisted to vehicles table.
// User must review all fields before registration.

import type { VehicleRegistrationOcrResult } from "@/lib/vehicle-registration/vehicle-registration-types";
import { resolveVehicleIdentity } from "@/lib/vehicle-registration/ocr-quality";

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
  input: Partial<VehicleRegistrationOcrResult>,
): Partial<VehicleFormState> {
  // Keep a leaked certificate 型式 / engine type out of 型式指定番号 and グレード (legacy replay guard).
  // NOTE: this form state has no 型式 (vehicle_code) field, so the certificate 型式 is not mapped here.
  const ocr = resolveVehicleIdentity(input, { ambiguousGrade: "keep" }).result;
  const result: Partial<VehicleFormState> = {};

  if (ocr.maker)                  result.maker       = ocr.maker;
  // 車名 comes ONLY from vehicle_name (operator-entered; the certificate does not carry the
  // commercial name). The certificate 型式 (model) is a type code and must never be used as a
  // substitute for 車名. This form state has no 型式 field, so 型式 is not mapped here.
  if (ocr.vehicle_name)           result.model       = ocr.vehicle_name;
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
