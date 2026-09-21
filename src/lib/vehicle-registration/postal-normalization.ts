const POSTAL_BODY = "([0-9０-９]{3})\\s*[-‐‑‒–—―−ー－]?\\s*([0-9０-９]{4})";
const COMPLETE_POSTAL = new RegExp(`^(?:〒\\s*)?${POSTAL_BODY}$`, "u");
const ADDRESS_POSTAL = new RegExp(`^(?:〒\\s*)?${POSTAL_BODY}\\s*`, "u");
const PARTIAL_POSTAL_PREFIX = /^(?:〒\s*)[0-9０-９]{1,3}\s*[-‐‑‒–—―−ー－]?\s*/u;

const halfWidthDigits = (value: string): string => value.replace(/[０-９]/g, (digit) =>
  String.fromCharCode(digit.charCodeAt(0) - 0xfee0),
);

/** Accept only a complete seven-digit Japanese postal code. Never infer missing digits. */
export function normalizeJapanesePostalCode(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const match = raw.trim().match(COMPLETE_POSTAL);
  if (!match) return null;
  return `${halfWidthDigits(match[1])}-${halfWidthDigits(match[2])}`;
}

/** Backward compatibility for older OCR payloads that embedded a complete postal code in address. */
export function postalCodeFromAddress(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const match = raw.trim().match(ADDRESS_POSTAL);
  if (!match) return null;
  return `${halfWidthDigits(match[1])}-${halfWidthDigits(match[2])}`;
}

/** Remove a complete or visibly partial leading postal token from the operator-facing address. */
export function addressWithoutLeadingPostal(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const withoutComplete = trimmed.replace(ADDRESS_POSTAL, "").trim();
  if (withoutComplete !== trimmed) return withoutComplete || null;
  const withoutPartial = trimmed.replace(PARTIAL_POSTAL_PREFIX, "").trim();
  return withoutPartial || null;
}
