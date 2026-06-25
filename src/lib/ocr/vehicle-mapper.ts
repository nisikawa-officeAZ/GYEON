// Sprint 7: OCR result → vehicle form state mapper

import type { VehicleRegistrationOcrResult } from "@/lib/vehicle-registration/vehicle-registration-types";

export interface VehicleFormState {
  maker:                  string;
  model:                  string;
  grade:                  string;
  year:                   string;
  color:                  string;
  plate_number:           string;
  vin:                    string;
  body_size:              string;
  inspection_expiry_date: string;
  notes:                  string;
}

export const EMPTY_VEHICLE_FORM: VehicleFormState = {
  maker:                  "",
  model:                  "",
  grade:                  "",
  year:                   "",
  color:                  "",
  plate_number:           "",
  vin:                    "",
  body_size:              "",
  inspection_expiry_date: "",
  notes:                  "",
};

function buildPlateNumber(ocr: Partial<VehicleRegistrationOcrResult>): string {
  const parts = [
    ocr.license_plate_region,
    ocr.license_plate_class,
    ocr.license_plate_kana,
    ocr.license_plate_number,
  ].filter(Boolean);
  return parts.join(" ");
}

export function mapOcrToVehicle(
  ocr: Partial<VehicleRegistrationOcrResult>,
): Partial<VehicleFormState> {
  const result: Partial<VehicleFormState> = {};

  if (ocr.maker)                  result.maker  = ocr.maker;
  if (ocr.vehicle_name)           result.model  = ocr.vehicle_name;
  if (ocr.grade)                  result.grade  = ocr.grade;
  if (ocr.color)                  result.color  = ocr.color;
  if (ocr.chassis_number)         result.vin    = ocr.chassis_number;
  if (ocr.inspection_expiry_date) result.inspection_expiry_date = ocr.inspection_expiry_date;

  const plate = buildPlateNumber(ocr);
  if (plate) result.plate_number = plate;

  if (ocr.first_registration_date) {
    const year = ocr.first_registration_date.slice(0, 4);
    if (year) result.year = year;
  }

  return result;
}
