// Sprint 7: OCR result → customer form state mapper

import type { VehicleRegistrationOcrResult } from "@/lib/vehicle-registration/vehicle-registration-types";

export interface CustomerFormState {
  last_name:       string;
  first_name:      string;
  last_name_kana:  string;
  first_name_kana: string;
  phone:           string;
  email:           string;
  address1:        string;
  notes:           string;
  line_user_id:    string;
  is_company:      boolean;
}

export const EMPTY_CUSTOMER_FORM: CustomerFormState = {
  last_name:       "",
  first_name:      "",
  last_name_kana:  "",
  first_name_kana: "",
  phone:           "",
  email:           "",
  address1:        "",
  notes:           "",
  line_user_id:    "",
  is_company:      false,
};

// Split a Japanese full name on space (half-width or full-width)
function splitJapaneseName(fullName: string): { lastName: string; firstName: string } {
  const trimmed = fullName.trim();
  const halfIdx      = trimmed.indexOf(" ");
  const fullWidthIdx = trimmed.indexOf("　");

  const splitAt = Math.min(
    halfIdx      === -1 ? Infinity : halfIdx,
    fullWidthIdx === -1 ? Infinity : fullWidthIdx,
  );

  if (!isFinite(splitAt)) return { lastName: trimmed, firstName: "" };

  return {
    lastName:  trimmed.slice(0, splitAt).trim(),
    firstName: trimmed.slice(splitAt + 1).trim(),
  };
}

export function mapOcrToCustomer(
  ocr: Partial<VehicleRegistrationOcrResult>,
): Partial<CustomerFormState> {
  const result: Partial<CustomerFormState> = {};

  const nameSource = ocr.user_name ?? ocr.owner_name;
  if (nameSource) {
    const { lastName, firstName } = splitJapaneseName(nameSource);
    if (lastName)  result.last_name  = lastName;
    if (firstName) result.first_name = firstName;
  }

  const addressSource = ocr.user_address ?? ocr.owner_address;
  if (addressSource) result.address1 = addressSource;

  return result;
}
