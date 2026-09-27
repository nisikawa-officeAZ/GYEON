import type { VehicleRegistrationOcrResult } from "@/lib/vehicle-registration/vehicle-registration-types";
import { resolveVehicleIdentity } from "@/lib/vehicle-registration/ocr-quality";
import {
  estimateBodySizeFromVehicleRegistrationOcr,
  type BodySizeEstimate,
} from "@/lib/vehicles/body-size-estimate";
import { buildWizardCustomerOcrPatch, type WizardCustomerOcrPatch } from "./wizard-customer-ocr-apply-core";

export const OCR_APPLICABLE_VEHICLE_FIELDS = [
  "maker",
  "model",
  "grade",
  "vehicleCode",
  "displacement",
  "vin",
  "firstRegYearMonth",
  "registrationDate",
  "inspectionExpiry",
  "color",
  "plateNumber",
] as const;

export type WizardVehicleOcrPatch = Partial<Record<(typeof OCR_APPLICABLE_VEHICLE_FIELDS)[number], string>>;

export interface WizardEstimateOcrApplication {
  customer: WizardCustomerOcrPatch;
  vehicle: WizardVehicleOcrPatch;
  bodySizeEstimate: BodySizeEstimate;
}

function nonBlank(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const value = raw.trim();
  return value === "" ? null : value;
}

/**
 * The one canonical OCR-to-estimate-wizard mapping used from both Screen 1 and Screen 2.
 * It only returns draft patches and a display-only 3M recommendation; it performs no writes.
 */
export function buildWizardEstimateOcrApplication(
  input: Partial<VehicleRegistrationOcrResult>,
  options: { source: "raw" | "reviewed" } = { source: "raw" },
): WizardEstimateOcrApplication {
  // Raw OCR needs fail-closed normalization. OcrEntry has already passed operator-edited,
  // checked fields through the review; re-filtering that payload would silently erase a
  // legitimate 型式 typed by the operator (including a hyphen-less certificate value).
  const result = options.source === "reviewed"
    ? input
    : resolveVehicleIdentity(input, { ambiguousGrade: "blank" }).result;
  const vehicle: WizardVehicleOcrPatch = {};
  const assign = (key: keyof WizardVehicleOcrPatch, raw: unknown) => {
    const value = nonBlank(raw);
    if (value !== null) vehicle[key] = value;
  };

  assign("maker", result.maker);
  assign("model", result.vehicle_name);
  assign("grade", result.grade);
  // 型式 comes ONLY from the certificate 型式 column. 型式指定番号 (model_code), 類別区分番号
  // (classification_number) and 原動機の型式 (engine_model) are different values and never substitute.
  // A legacy unconfirmed value is not applied even if a raw caller bypasses the review.
  if (result.model_needs_confirmation !== "true") assign("vehicleCode", result.model);
  assign("displacement", result.displacement);
  assign("vin", result.chassis_number);
  assign("firstRegYearMonth", result.first_registration_date);
  assign("registrationDate", result.registration_date);
  assign("inspectionExpiry", result.inspection_expiry_date);
  assign("color", result.color);

  const plateNumber = [
    result.license_plate_region,
    result.license_plate_class,
    result.license_plate_kana,
    result.license_plate_number,
  ].map(nonBlank).filter((value): value is string => value !== null).join(" ");
  if (plateNumber !== "") vehicle.plateNumber = plateNumber;

  return {
    customer: buildWizardCustomerOcrPatch(result),
    vehicle,
    bodySizeEstimate: estimateBodySizeFromVehicleRegistrationOcr(result),
  };
}
