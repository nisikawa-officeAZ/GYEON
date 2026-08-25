import type { CoatingSettings } from "@/lib/dealer-settings/dealer-settings-types";
import {
  COATING_V34_BODY_SIZES,
  parseCoatingSettingsV34,
  type CoatingSettingsV34,
} from "./coating-v34-contract";
import {
  projectLegacyCoatingV34Candidates,
  type LegacyCoatingV34Candidates,
} from "./coating-v34-legacy-candidate";

export type StoredCoatingV34Resolution =
  | { status: "V34_READY"; settings: CoatingSettingsV34 }
  | { status: "LEGACY_REVIEW_REQUIRED"; candidates: LegacyCoatingV34Candidates }
  | { status: "NOT_CONFIGURED" }
  | { status: "INVALID_STORED_PAYLOAD" };

const LEGACY_COATING_KEYS = [
  "products",
  "size_multipliers",
  "topcoat_prices",
  "option_prices",
  "option_names",
] as const;

const LEGACY_PRODUCT_KEYS = [
  "id",
  "name",
  "grade",
  "base_price_m",
  "certified_only",
  "active",
] as const;

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function hasExactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const keys = Object.keys(value);
  return keys.length === expected.length && keys.every((key) => expected.includes(key));
}

function validId(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "" && value === value.trim();
}

function validText(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}

function validLegacyMoney(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function validLegacyMultiplier(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function parseNumberMap(
  value: unknown,
  validator: (entry: unknown) => entry is number,
): Record<string, number> | null {
  const source = record(value);
  if (!source) return null;
  const output: Record<string, number> = {};
  for (const [key, entry] of Object.entries(source)) {
    if (!validId(key) || !validator(entry)) return null;
    output[key] = entry;
  }
  return output;
}

function parseStringMap(value: unknown): Record<string, string> | null {
  const source = record(value);
  if (!source) return null;
  const output: Record<string, string> = {};
  for (const [key, entry] of Object.entries(source)) {
    if (!validId(key) || !validText(entry)) return null;
    output[key] = entry;
  }
  return output;
}

function parseLegacyCoating(value: unknown): CoatingSettings | null {
  const source = record(value);
  if (!source || !hasExactKeys(source, LEGACY_COATING_KEYS)) return null;
  if (!Array.isArray(source.products)) return null;

  const productIds = new Set<string>();
  const products: CoatingSettings["products"] = [];
  for (const entry of source.products) {
    const product = record(entry);
    if (!product || !hasExactKeys(product, LEGACY_PRODUCT_KEYS)) return null;
    if (
      !validId(product.id) ||
      productIds.has(product.id) ||
      !validText(product.name) ||
      !validText(product.grade) ||
      !validLegacyMoney(product.base_price_m) ||
      typeof product.certified_only !== "boolean" ||
      typeof product.active !== "boolean"
    ) {
      return null;
    }
    productIds.add(product.id);
    products.push({
      id: product.id,
      name: product.name,
      grade: product.grade,
      base_price_m: product.base_price_m,
      certified_only: product.certified_only,
      active: product.active,
    });
  }

  const multiplierSource = record(source.size_multipliers);
  if (!multiplierSource || !hasExactKeys(multiplierSource, COATING_V34_BODY_SIZES)) return null;
  const size_multipliers = Object.fromEntries(
    COATING_V34_BODY_SIZES.map((size) => [size, multiplierSource[size]]),
  );
  if (Object.values(size_multipliers).some((value) => !validLegacyMultiplier(value))) return null;

  const topcoat_prices = parseNumberMap(source.topcoat_prices, validLegacyMoney);
  const option_prices = parseNumberMap(source.option_prices, validLegacyMoney);
  const option_names = parseStringMap(source.option_names);
  if (!topcoat_prices || !option_prices || !option_names) return null;

  return {
    products,
    size_multipliers: size_multipliers as CoatingSettings["size_multipliers"],
    topcoat_prices,
    option_prices,
    option_names,
  };
}

/**
 * Resolves only the coating member of the persisted service-price JSON.
 * It never returns unrelated sibling settings or substitutes application defaults.
 */
export function resolveStoredCoatingV34(
  servicePriceSettings: unknown,
): StoredCoatingV34Resolution {
  if (servicePriceSettings === null || servicePriceSettings === undefined) {
    return { status: "NOT_CONFIGURED" };
  }

  const root = record(servicePriceSettings);
  if (!root) return { status: "INVALID_STORED_PAYLOAD" };
  if (!Object.prototype.hasOwnProperty.call(root, "coating") || root.coating === null) {
    return { status: "NOT_CONFIGURED" };
  }

  const coating = record(root.coating);
  if (!coating) return { status: "INVALID_STORED_PAYLOAD" };

  if (Object.prototype.hasOwnProperty.call(coating, "contractVersion")) {
    try {
      return { status: "V34_READY", settings: parseCoatingSettingsV34(coating) };
    } catch {
      return { status: "INVALID_STORED_PAYLOAD" };
    }
  }

  const legacy = parseLegacyCoating(coating);
  if (!legacy) return { status: "INVALID_STORED_PAYLOAD" };
  try {
    return {
      status: "LEGACY_REVIEW_REQUIRED",
      candidates: projectLegacyCoatingV34Candidates(legacy),
    };
  } catch {
    return { status: "INVALID_STORED_PAYLOAD" };
  }
}
