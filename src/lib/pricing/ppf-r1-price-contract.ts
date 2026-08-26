import type { BodySizeKey } from "@/lib/dealer-settings/dealer-settings-types";

export const PPF_R1_CONTRACT_VERSION = "1.0" as const;

export const PPF_R1_BODY_SIZES = [
  "SS",
  "S",
  "M",
  "ML",
  "L",
  "LL",
  "XL",
] as const satisfies readonly BodySizeKey[];

export type PpfR1BodySize = (typeof PPF_R1_BODY_SIZES)[number];
export type PpfR1SizePriceMap = Record<PpfR1BodySize, number | null>;

export interface PpfR1PriceSettings {
  contractVersion: typeof PPF_R1_CONTRACT_VERSION;
  frontFullPricesBySize: PpfR1SizePriceMap;
  fullBodyPricesBySize: PpfR1SizePriceMap;
  partialPartPrices: Record<string, number | null>;
}

const TOP_LEVEL_KEYS = [
  "contractVersion",
  "frontFullPricesBySize",
  "fullBodyPricesBySize",
  "partialPartPrices",
] as const;

// Part codes are the canonical wizard-catalog machine identifiers, not free-text
// labels. Keep this aligned with wizard-runtime-config's CODE_RE: the seeded
// PPF parts include hyphenated identities such as `front-bumper` and
// `door-mirror`, while dealer-authored identities may also use underscores.
const STABLE_PART_CODE_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/;

function fail(path: string, reason: string): never {
  throw new TypeError(`Invalid PPF R1 contract at ${path}: ${reason}`);
}

function requireRecord(value: unknown, path: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    fail(path, "expected an object");
  }
  return value as Record<string, unknown>;
}

function requireExactKeys(
  record: Record<string, unknown>,
  expected: readonly string[],
  path: string,
): void {
  const actual = Object.keys(record);
  const missing = expected.filter((key) => !Object.prototype.hasOwnProperty.call(record, key));
  const extra = actual.filter((key) => !expected.includes(key));
  if (missing.length > 0) fail(path, `missing keys: ${missing.join(", ")}`);
  if (extra.length > 0) fail(path, `unknown keys: ${extra.join(", ")}`);
}

function requireYenOrNull(value: unknown, path: string): number | null {
  if (value === null) return null;
  if (typeof value !== "number" || !Number.isFinite(value)) {
    fail(path, "expected a finite safe-integer yen value or null");
  }
  if (!Number.isSafeInteger(value)) fail(path, "unsafe or fractional yen is forbidden");
  if (value < 0) fail(path, "negative yen is forbidden");
  return value;
}

function parseSizePrices(value: unknown, path: string): PpfR1SizePriceMap {
  const record = requireRecord(value, path);
  requireExactKeys(record, PPF_R1_BODY_SIZES, path);

  return Object.fromEntries(
    PPF_R1_BODY_SIZES.map((size) => [size, requireYenOrNull(record[size], `${path}.${size}`)]),
  ) as PpfR1SizePriceMap;
}

function requirePartCode(value: string, path: string): string {
  if (value.trim() === "" || value !== value.trim()) {
    fail(path, "expected a non-blank part code");
  }
  if (!STABLE_PART_CODE_PATTERN.test(value)) {
    fail(path, "expected a safe lowercase alnum/hyphen/underscore part code");
  }
  return value;
}

function parsePartialPartPrices(
  value: unknown,
  path: string,
): Record<string, number | null> {
  const record = requireRecord(value, path);
  const seen = new Set<string>();

  return Object.fromEntries(
    Object.entries(record).map(([key, price]) => {
      const partCode = requirePartCode(key, `${path}.${key}`);
      if (seen.has(partCode)) fail(path, `duplicate part code: ${partCode}`);
      seen.add(partCode);
      return [partCode, requireYenOrNull(price, `${path}.${partCode}`)];
    }),
  );
}

/**
 * Parses untrusted persisted JSON into the exact PPF R1 price contract.
 * Unknown, missing, and legacy five-map fields fail closed; this parser
 * never supplies a legacy or hardcoded default price.
 */
export function parsePpfR1PriceSettings(value: unknown): PpfR1PriceSettings {
  const record = requireRecord(value, "$ppf");
  requireExactKeys(record, TOP_LEVEL_KEYS, "$ppf");
  if (record.contractVersion !== PPF_R1_CONTRACT_VERSION) {
    fail("$ppf.contractVersion", `expected ${PPF_R1_CONTRACT_VERSION}`);
  }

  return {
    contractVersion: PPF_R1_CONTRACT_VERSION,
    frontFullPricesBySize: parseSizePrices(
      record.frontFullPricesBySize,
      "$ppf.frontFullPricesBySize",
    ),
    fullBodyPricesBySize: parseSizePrices(
      record.fullBodyPricesBySize,
      "$ppf.fullBodyPricesBySize",
    ),
    partialPartPrices: parsePartialPartPrices(record.partialPartPrices, "$ppf.partialPartPrices"),
  };
}
