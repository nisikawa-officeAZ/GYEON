import type { BodySizeKey } from "@/lib/dealer-settings/dealer-settings-types";

export const COATING_V34_CONTRACT_VERSION = "3.4" as const;

export const COATING_V34_BODY_SIZES = [
  "SS",
  "S",
  "M",
  "ML",
  "L",
  "LL",
  "XL",
] as const satisfies readonly BodySizeKey[];

export type CoatingV34BodySize = (typeof COATING_V34_BODY_SIZES)[number];
export type CoatingV34SizePriceMap = Record<CoatingV34BodySize, number | null>;

export interface CoatingV34BaseProductPrice {
  productId: string;
  active: boolean;
  pricesBySize: CoatingV34SizePriceMap;
}

export interface CoatingV34Layer2ProductPrice {
  productId: string;
  active: boolean;
  layer2PricesBySize: CoatingV34SizePriceMap;
}

export interface CoatingV34Layer3ProductPrice {
  productId: string;
  active: boolean;
  layer3PricesBySize: CoatingV34SizePriceMap;
}

export interface CoatingSettingsV34 {
  contractVersion: typeof COATING_V34_CONTRACT_VERSION;
  baseProducts: CoatingV34BaseProductPrice[];
  layer2Products: CoatingV34Layer2ProductPrice[];
  layer3Products: CoatingV34Layer3ProductPrice[];
  option_prices: Record<string, number>;
  option_names: Record<string, string>;
}

const TOP_LEVEL_KEYS = [
  "contractVersion",
  "baseProducts",
  "layer2Products",
  "layer3Products",
  "option_prices",
  "option_names",
] as const;

function fail(path: string, reason: string): never {
  throw new TypeError(`Invalid coating V3.4 contract at ${path}: ${reason}`);
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

function requireProductId(value: unknown, path: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    fail(path, "expected a non-empty product ID");
  }
  if (value !== value.trim()) fail(path, "product ID must not have outer whitespace");
  return value;
}

function requireActive(value: unknown, path: string): boolean {
  if (typeof value !== "boolean") fail(path, "expected a boolean");
  return value;
}

function requireYenOrNull(value: unknown, path: string): number | null {
  if (value === null) return null;
  if (typeof value !== "number" || !Number.isFinite(value)) {
    fail(path, "expected a finite integer yen value or null");
  }
  if (!Number.isInteger(value)) fail(path, "fractional yen is forbidden");
  if (value < 0) fail(path, "negative yen is forbidden");
  return value;
}

function requireYen(value: unknown, path: string): number {
  const parsed = requireYenOrNull(value, path);
  if (parsed === null) fail(path, "expected a finite integer yen value");
  return parsed;
}

function parseSizePrices(value: unknown, path: string): CoatingV34SizePriceMap {
  const record = requireRecord(value, path);
  requireExactKeys(record, COATING_V34_BODY_SIZES, path);

  return Object.fromEntries(
    COATING_V34_BODY_SIZES.map((size) => [
      size,
      requireYenOrNull(record[size], `${path}.${size}`),
    ]),
  ) as CoatingV34SizePriceMap;
}

function parseProductCatalog<T>(
  value: unknown,
  path: string,
  priceKey: "pricesBySize" | "layer2PricesBySize" | "layer3PricesBySize",
): T[] {
  if (!Array.isArray(value)) fail(path, "expected an array");
  const seen = new Set<string>();

  return value.map((entry, index) => {
    const entryPath = `${path}[${index}]`;
    const record = requireRecord(entry, entryPath);
    requireExactKeys(record, ["productId", "active", priceKey], entryPath);
    const productId = requireProductId(record.productId, `${entryPath}.productId`);
    if (seen.has(productId)) fail(entryPath, `duplicate product ID: ${productId}`);
    seen.add(productId);

    return {
      productId,
      active: requireActive(record.active, `${entryPath}.active`),
      [priceKey]: parseSizePrices(record[priceKey], `${entryPath}.${priceKey}`),
    } as T;
  });
}

function parseYenMap(value: unknown, path: string): Record<string, number> {
  const record = requireRecord(value, path);
  return Object.fromEntries(
    Object.entries(record).map(([key, price]) => {
      if (key.trim() === "" || key !== key.trim()) fail(path, "invalid option ID");
      return [key, requireYen(price, `${path}.${key}`)];
    }),
  );
}

function parseNameMap(value: unknown, path: string): Record<string, string> {
  const record = requireRecord(value, path);
  return Object.fromEntries(
    Object.entries(record).map(([key, name]) => {
      if (key.trim() === "" || key !== key.trim()) fail(path, "invalid option ID");
      if (typeof name !== "string" || name.trim() === "") {
        fail(`${path}.${key}`, "expected a non-empty string");
      }
      return [key, name];
    }),
  );
}

/**
 * Parses untrusted persisted JSON into the exact V3.4 coating price contract.
 * Unknown and legacy fields fail closed; this parser never supplies defaults.
 */
export function parseCoatingSettingsV34(value: unknown): CoatingSettingsV34 {
  const record = requireRecord(value, "$coating");
  requireExactKeys(record, TOP_LEVEL_KEYS, "$coating");
  if (record.contractVersion !== COATING_V34_CONTRACT_VERSION) {
    fail("$coating.contractVersion", `expected ${COATING_V34_CONTRACT_VERSION}`);
  }

  return {
    contractVersion: COATING_V34_CONTRACT_VERSION,
    baseProducts: parseProductCatalog<CoatingV34BaseProductPrice>(
      record.baseProducts,
      "$coating.baseProducts",
      "pricesBySize",
    ),
    layer2Products: parseProductCatalog<CoatingV34Layer2ProductPrice>(
      record.layer2Products,
      "$coating.layer2Products",
      "layer2PricesBySize",
    ),
    layer3Products: parseProductCatalog<CoatingV34Layer3ProductPrice>(
      record.layer3Products,
      "$coating.layer3Products",
      "layer3PricesBySize",
    ),
    option_prices: parseYenMap(record.option_prices, "$coating.option_prices"),
    option_names: parseNameMap(record.option_names, "$coating.option_names"),
  };
}
