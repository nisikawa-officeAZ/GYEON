import type { VehicleRegistrationOcrResult } from "@/lib/vehicle-registration/vehicle-registration-types";
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
  result: Partial<VehicleRegistrationOcrResult>,
): WizardEstimateOcrApplication {
  const vehicle: WizardVehicleOcrPatch = {};
  const assign = (key: keyof WizardVehicleOcrPatch, raw: unknown) => {
    const value = nonBlank(raw);
    if (value !== null) vehicle[key] = value;
  };

  assign("maker", result.maker);
  assign("model", result.vehicle_name);
  assign("grade", result.grade);
  assign("vehicleCode", result.model ?? result.model_code);
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
