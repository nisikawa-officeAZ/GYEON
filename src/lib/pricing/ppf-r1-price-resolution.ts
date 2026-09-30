import {
  PPF_R1_BODY_SIZES,
  type PpfR1BodySize,
  type PpfR1PriceSettings,
} from "./ppf-r1-price-contract";

export const PPF_COEFFICIENT_BP_IDENTITY = 10_000 as const;

export type PpfR1PricingScope =
  | { readonly kind: "front_full"; readonly bodySize: string }
  | { readonly kind: "full_body"; readonly bodySize: string }
  | {
      readonly kind: "partial";
      readonly parts: readonly {
        readonly partCode: string;
        readonly quantity: number;
      }[];
    };

export type PpfR1PriceResolutionFailure =
  | "INVALID_BODY_SIZE"
  | "NO_PARTS_SELECTED"
  | "DUPLICATE_PART"
  | "INVALID_PART_QUANTITY"
  | "SCOPE_PRICE_NOT_CONFIGURED"
  | "PART_PRICE_NOT_CONFIGURED"
  | "INVALID_INSTALL_COEFFICIENT"
  | "INVALID_VEHICLE_COEFFICIENT"
  | "PRICE_OVERFLOW";

export type PpfR1PriceResolution =
  | {
      readonly ok: true;
      readonly scope: PpfR1PricingScope["kind"];
      readonly bodySize: PpfR1BodySize | null;
      readonly basePriceYen: number;
      readonly installCoefficientBp: number;
      readonly vehicleCoefficientBp: number;
      readonly resolvedPriceYen: number;
    }
  | {
      readonly ok: false;
      readonly reason: PpfR1PriceResolutionFailure;
      readonly partCode?: string;
    };

/**
 * GDA-ESTIMATE-QUANTITY-POLICY-R1 (Stage B) — the tax-exclusive UNIT price of ONE selected partial
 * PPF part. Quantity is deliberately NOT an input: the wizard multiplies this unit price by the
 * bounded integer quantity afterwards, so "quantity 2" is exactly two identical units at the
 * displayed unit price and `unit_price × quantity = line_total` holds without a second rounding.
 */
export type PpfR1PartUnitPriceResolution =
  | {
      readonly ok: true;
      readonly partCode: string;
      readonly basePriceYen: number;
      readonly installCoefficientBp: number;
      readonly vehicleCoefficientBp: number;
      readonly unitPriceYen: number;
    }
  | {
      readonly ok: false;
      readonly reason: PpfR1PriceResolutionFailure;
      readonly partCode: string;
    };

function isBodySize(value: string): value is PpfR1BodySize {
  return PPF_R1_BODY_SIZES.some((size) => size === value);
}

function isPositiveSafeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function resolveBasePrice(
  settings: PpfR1PriceSettings,
  scope: PpfR1PricingScope,
):
  | { readonly ok: true; readonly bodySize: PpfR1BodySize | null; readonly basePriceYen: number }
  | { readonly ok: false; readonly reason: PpfR1PriceResolutionFailure; readonly partCode?: string } {
  if (scope.kind === "front_full" || scope.kind === "full_body") {
    if (!isBodySize(scope.bodySize)) return { ok: false, reason: "INVALID_BODY_SIZE" };
    const prices = scope.kind === "front_full"
      ? settings.frontFullPricesBySize
      : settings.fullBodyPricesBySize;
    const price = prices[scope.bodySize];
    if (price === null) return { ok: false, reason: "SCOPE_PRICE_NOT_CONFIGURED" };
    return { ok: true, bodySize: scope.bodySize, basePriceYen: price };
  }

  if (scope.parts.length === 0) return { ok: false, reason: "NO_PARTS_SELECTED" };

  const seen = new Set<string>();
  let total = 0;
  for (const part of scope.parts) {
    if (seen.has(part.partCode)) {
      return { ok: false, reason: "DUPLICATE_PART", partCode: part.partCode };
    }
    seen.add(part.partCode);
    if (!isPositiveSafeInteger(part.quantity)) {
      return { ok: false, reason: "INVALID_PART_QUANTITY", partCode: part.partCode };
    }
    const price = settings.partialPartPrices[part.partCode];
    if (price === undefined || price === null) {
      return { ok: false, reason: "PART_PRICE_NOT_CONFIGURED", partCode: part.partCode };
    }
    const extended = price * part.quantity;
    if (!Number.isSafeInteger(extended) || !Number.isSafeInteger(total + extended)) {
      return { ok: false, reason: "PRICE_OVERFLOW" };
    }
    total += extended;
  }

  return { ok: true, bodySize: null, basePriceYen: total };
}

/**
 * `round(base × installBp × vehicleBp / 10⁸)` with the complete integer numerator guarded as a safe
 * JS integer at every multiplication. Shared by the scope resolver and the per-part resolver so the
 * two can never drift: one part at quantity 1 yields exactly the legacy aggregate yen.
 */
function applyCoefficientsOnce(
  basePriceYen: number,
  installCoefficientBp: number,
  vehicleCoefficientBp: number,
): number | null {
  const afterInstallNumerator = basePriceYen * installCoefficientBp;
  if (!Number.isSafeInteger(afterInstallNumerator)) return null;
  const numerator = afterInstallNumerator * vehicleCoefficientBp;
  if (!Number.isSafeInteger(numerator)) return null;
  const denominator = PPF_COEFFICIENT_BP_IDENTITY * PPF_COEFFICIENT_BP_IDENTITY;
  const resolvedPriceYen = Math.round(numerator / denominator);
  return Number.isSafeInteger(resolvedPriceYen) ? resolvedPriceYen : null;
}

/**
 * Resolve the authoritative PPF price before any PPF+coating reduction.
 *
 * Formula: scope price x installation coefficient x vehicle coefficient.
 * Both coefficients are integer basis points (10000 = x1.0). The operation is
 * is accepted only while the complete integer numerator remains a safe JS
 * integer, then rounded once. Unsafe arithmetic fails closed instead of
 * silently drifting. Null is never converted to zero.
 */
export function resolvePpfR1Price(
  settings: PpfR1PriceSettings,
  scope: PpfR1PricingScope,
  installCoefficientBp: number,
  vehicleCoefficientBp: number = PPF_COEFFICIENT_BP_IDENTITY,
): PpfR1PriceResolution {
  if (!isPositiveSafeInteger(installCoefficientBp)) {
    return { ok: false, reason: "INVALID_INSTALL_COEFFICIENT" };
  }
  if (!isPositiveSafeInteger(vehicleCoefficientBp)) {
    return { ok: false, reason: "INVALID_VEHICLE_COEFFICIENT" };
  }

  const base = resolveBasePrice(settings, scope);
  if (!base.ok) return base;

  const resolvedPriceYen = applyCoefficientsOnce(base.basePriceYen, installCoefficientBp, vehicleCoefficientBp);
  if (resolvedPriceYen === null) return { ok: false, reason: "PRICE_OVERFLOW" };

  return {
    ok: true,
    scope: scope.kind,
    bodySize: base.bodySize,
    basePriceYen: base.basePriceYen,
    installCoefficientBp,
    vehicleCoefficientBp,
    resolvedPriceYen,
  };
}

/**
 * Resolve the tax-exclusive unit price of ONE configured partial PPF part:
 * `round(partPriceYen × installBp × vehicleBp / 10⁸)`, rounded exactly once per part.
 *
 * Fail-closed like `resolvePpfR1Price`: an unconfigured (`null`/absent) part price, an invalid
 * coefficient, or unsafe arithmetic is a failure carrying the part code — never a silent zero or
 * default price. Zero is an explicit configured price and resolves to 0.
 */
export function resolvePpfR1PartUnitPrice(
  settings: PpfR1PriceSettings,
  partCode: string,
  installCoefficientBp: number,
  vehicleCoefficientBp: number = PPF_COEFFICIENT_BP_IDENTITY,
): PpfR1PartUnitPriceResolution {
  if (!isPositiveSafeInteger(installCoefficientBp)) {
    return { ok: false, reason: "INVALID_INSTALL_COEFFICIENT", partCode };
  }
  if (!isPositiveSafeInteger(vehicleCoefficientBp)) {
    return { ok: false, reason: "INVALID_VEHICLE_COEFFICIENT", partCode };
  }
  const price = Object.prototype.hasOwnProperty.call(settings.partialPartPrices, partCode)
    ? settings.partialPartPrices[partCode]
    : undefined;
  if (price === undefined || price === null) {
    return { ok: false, reason: "PART_PRICE_NOT_CONFIGURED", partCode };
  }
  const unitPriceYen = applyCoefficientsOnce(price, installCoefficientBp, vehicleCoefficientBp);
  if (unitPriceYen === null) return { ok: false, reason: "PRICE_OVERFLOW", partCode };
  return { ok: true, partCode, basePriceYen: price, installCoefficientBp, vehicleCoefficientBp, unitPriceYen };
}
