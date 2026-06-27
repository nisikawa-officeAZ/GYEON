// RC-02: OCR result → customer form state mapper
//
// Maps vehicle registration certificate (車検証) OCR output to customer fields.
// Fields not present in vehicle registration (phone, email, kana) are left empty.
// User must review all fields before registration.

import type { VehicleRegistrationOcrResult } from "@/lib/vehicle-registration/vehicle-registration-types";

// ─── Customer form state ──────────────────────────────────────────────────────

export interface CustomerFormState {
  last_name:       string;
  first_name:      string;
  last_name_kana:  string;
  first_name_kana: string;
  phone:           string;
  email:           string;
  postal_code:     string;
  prefecture:      string;
  city:            string;
  address1:        string;  // Full address line (street / 番地 etc.)
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
  postal_code:     "",
  prefecture:      "",
  city:            "",
  address1:        "",
  notes:           "",
  line_user_id:    "",
  is_company:      false,
};

// ─── Japanese name splitter ───────────────────────────────────────────────────

function splitJapaneseName(fullName: string): { lastName: string; firstName: string } {
  const trimmed = fullName.trim();
  // Half-width space or full-width space
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

// ─── Japanese address parser ──────────────────────────────────────────────────
//
// Extracts postal_code, prefecture, city, and remaining address_line from
// a Japanese address string.
//
// Supported formats:
//   〒150-0001 東京都渋谷区神宮前１丁目１番１号
//   150-0001東京都渋谷区神宮前１丁目１番１号
//   東京都渋谷区神宮前１丁目１番１号

interface ParsedJapaneseAddress {
  postal_code?: string;
  prefecture?:  string;
  city?:        string;
  address1?:    string;  // remaining street address
}

function parseJapaneseAddress(raw: string): ParsedJapaneseAddress {
  if (!raw || !raw.trim()) return {};

  const result: ParsedJapaneseAddress = {};
  let addr = raw.trim();

  // 1. Extract postal code: 〒XXX-XXXX or XXX-XXXX (hyphen or full-width hyphen)
  const postalMatch = addr.match(/〒?\s*(\d{3}[－-]\d{4})/);
  if (postalMatch) {
    result.postal_code = postalMatch[1].replace("－", "-");
    addr = addr.replace(postalMatch[0], "").trim();
  }

  // 2. Extract prefecture: longest match ending in 都/道/府/県
  const prefMatch = addr.match(/^([^\s\d０-９]+?(?:都|道|府|県))/u);
  if (prefMatch) {
    result.prefecture = prefMatch[1];
    addr = addr.slice(prefMatch[1].length).trim();
  }

  // 3. Extract city/ward/town: longest match ending in 市/区/町/村/郡
  const cityMatch = addr.match(/^([^\s\d０-９]+?(?:市|区|町|村|郡))/u);
  if (cityMatch) {
    result.city = cityMatch[1];
    addr = addr.slice(cityMatch[1].length).trim();
  }

  // 4. Remaining string is the street address
  if (addr) {
    result.address1 = addr;
  }

  return result;
}

// ─── Main mapper ──────────────────────────────────────────────────────────────

export function mapOcrToCustomer(
  ocr: Partial<VehicleRegistrationOcrResult>,
): Partial<CustomerFormState> {
  const result: Partial<CustomerFormState> = {};

  // Name: prefer user_name (使用者) over owner_name (所有者)
  const nameSource = ocr.user_name ?? ocr.owner_name;
  if (nameSource) {
    const { lastName, firstName } = splitJapaneseName(nameSource);
    if (lastName)  result.last_name  = lastName;
    if (firstName) result.first_name = firstName;
  }

  // Address: prefer user_address over owner_address
  const addressSource = ocr.user_address ?? ocr.owner_address;
  if (addressSource) {
    const parsed = parseJapaneseAddress(addressSource);
    if (parsed.postal_code) result.postal_code = parsed.postal_code;
    if (parsed.prefecture)  result.prefecture  = parsed.prefecture;
    if (parsed.city)        result.city        = parsed.city;
    // address1 = remaining street address; fall back to full address if not parseable
    result.address1 = parsed.address1 ?? addressSource;
  }

  return result;
}
