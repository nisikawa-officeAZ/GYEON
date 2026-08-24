import type { CoatingSettings } from "@/lib/dealer-settings/dealer-settings-types";
import {
  COATING_V34_BODY_SIZES,
  type CoatingV34BaseProductPrice,
  type CoatingV34BodySize,
  type CoatingV34Layer2ProductPrice,
  type CoatingV34Layer3ProductPrice,
  type CoatingV34SizePriceMap,
} from "./coating-v34-contract";

export interface LegacyBasePriceCandidate {
  productId: string;
  active: boolean;
  candidatePricesBySize: CoatingV34SizePriceMap;
  requiresConfirmation: true;
}

export interface LegacyUnassignedUpperLayerCandidate {
  productId: string;
  candidatePricesBySize: CoatingV34SizePriceMap;
  requiresLayer2Confirmation: true;
  requiresLayer3Confirmation: true;
}

export interface LegacyCoatingV34Candidates {
  baseProducts: LegacyBasePriceCandidate[];
  unassignedUpperLayerProducts: LegacyUnassignedUpperLayerCandidate[];
  option_prices: Record<string, number>;
  option_names: Record<string, string>;
}

function requireLegacyMoney(value: unknown, path: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new TypeError(`Invalid legacy coating value at ${path}`);
  }
  return value;
}

function requireLegacyMultiplier(value: unknown, path: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    throw new TypeError(`Invalid legacy coating multiplier at ${path}`);
  }
  return value;
}

function projectSizePrices(
  basePrice: number,
  multipliers: CoatingSettings["size_multipliers"],
): CoatingV34SizePriceMap {
  return Object.fromEntries(
    COATING_V34_BODY_SIZES.map((size) => [
      size,
      Math.round(
        requireLegacyMoney(basePrice, "base price") *
          requireLegacyMultiplier(multipliers[size], `size_multipliers.${size}`),
      ),
    ]),
  ) as CoatingV34SizePriceMap;
}

function assertExactLegacySizes(multipliers: Record<string, unknown>): void {
  const actual = Object.keys(multipliers);
  const missing = COATING_V34_BODY_SIZES.filter(
    (size) => !Object.prototype.hasOwnProperty.call(multipliers, size),
  );
  const extra = actual.filter(
    (size) => !COATING_V34_BODY_SIZES.includes(size as CoatingV34BodySize),
  );
  if (missing.length > 0 || extra.length > 0) {
    throw new TypeError(
      `Invalid legacy size contract; missing=${missing.join(",")}; extra=${extra.join(",")}`,
    );
  }
}

/**
 * Produces read-only review candidates from the old multiplier contract.
 * The old flat topcoat map is intentionally left position-unassigned: a human
 * must confirm layer 2 or layer 3 separately before it can enter V3.4 state.
 */
export function projectLegacyCoatingV34Candidates(
  legacy: CoatingSettings,
): LegacyCoatingV34Candidates {
  assertExactLegacySizes(legacy.size_multipliers);
  const baseIds = new Set<string>();
  const upperIds = new Set<string>();

  const baseProducts = legacy.products.map((product, index) => {
    if (typeof product.id !== "string" || product.id.trim() === "" || product.id !== product.id.trim()) {
      throw new TypeError(`Invalid legacy product ID at products[${index}]`);
    }
    if (baseIds.has(product.id)) throw new TypeError(`Duplicate legacy base product ID: ${product.id}`);
    if (typeof product.active !== "boolean") throw new TypeError(`Invalid legacy active flag: ${product.id}`);
    baseIds.add(product.id);
    return {
      productId: product.id,
      active: product.active,
      candidatePricesBySize: projectSizePrices(product.base_price_m, legacy.size_multipliers),
      requiresConfirmation: true,
    } satisfies LegacyBasePriceCandidate;
  });

  const unassignedUpperLayerProducts = Object.entries(legacy.topcoat_prices).map(
    ([productId, basePrice]) => {
      if (productId.trim() === "" || productId !== productId.trim()) {
        throw new TypeError("Invalid legacy upper-layer product ID");
      }
      if (upperIds.has(productId)) throw new TypeError(`Duplicate legacy upper-layer product ID: ${productId}`);
      upperIds.add(productId);
      return {
        productId,
        candidatePricesBySize: projectSizePrices(basePrice, legacy.size_multipliers),
        requiresLayer2Confirmation: true,
        requiresLayer3Confirmation: true,
      } satisfies LegacyUnassignedUpperLayerCandidate;
    },
  );

  return {
    baseProducts,
    unassignedUpperLayerProducts,
    option_prices: { ...legacy.option_prices },
    option_names: { ...legacy.option_names },
  };
}

/** Converts one reviewed candidate into exactly one chosen layer. */
export function confirmLegacyUpperLayerCandidate(
  candidate: LegacyUnassignedUpperLayerCandidate,
  layer: "layer2",
  active: boolean,
): CoatingV34Layer2ProductPrice;
export function confirmLegacyUpperLayerCandidate(
  candidate: LegacyUnassignedUpperLayerCandidate,
  layer: "layer3",
  active: boolean,
): CoatingV34Layer3ProductPrice;
export function confirmLegacyUpperLayerCandidate(
  candidate: LegacyUnassignedUpperLayerCandidate,
  layer: "layer2" | "layer3",
  active: boolean,
): CoatingV34Layer2ProductPrice | CoatingV34Layer3ProductPrice {
  if (typeof active !== "boolean") throw new TypeError("Confirmation requires an explicit active boolean");
  const prices = { ...candidate.candidatePricesBySize };
  return layer === "layer2"
    ? { productId: candidate.productId, active, layer2PricesBySize: prices }
    : { productId: candidate.productId, active, layer3PricesBySize: prices };
}

/** Converts one reviewed base candidate without silently accepting it. */
export function confirmLegacyBaseCandidate(
  candidate: LegacyBasePriceCandidate,
): CoatingV34BaseProductPrice {
  return {
    productId: candidate.productId,
    active: candidate.active,
    pricesBySize: { ...candidate.candidatePricesBySize },
  };
}
