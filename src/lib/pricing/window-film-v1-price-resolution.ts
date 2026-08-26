import type { WindowFilmSettingsV1 } from "./window-film-v1-contract";

export const WINDOW_FILM_COEFFICIENT_BP_IDENTITY = 10_000 as const;

export interface WindowFilmPriceSelection {
  areaCodes: readonly string[];
  packageCode: string | null;
  options: readonly { code: string; quantity: number }[];
}

export type WindowFilmPriceResolution =
  | {
      ok: true;
      basePriceYen: number;
      filmCoefficientBp: number;
      adjustedBasePriceYen: number;
      optionPriceYen: number;
      totalPriceYen: number;
      totalDurationMinutes: number;
    }
  | {
      ok: false;
      reason:
        | "INVALID_FILM_COEFFICIENT"
        | "PACKAGE_AND_AREAS_SELECTED"
        | "NO_SCOPE_SELECTED"
        | "DUPLICATE_AREA"
        | "AREA_NOT_CONFIGURED"
        | "PACKAGE_NOT_CONFIGURED"
        | "DUPLICATE_OPTION"
        | "INVALID_OPTION_QUANTITY"
        | "OPTION_NOT_CONFIGURED"
        | "PRICE_OVERFLOW";
      code?: string;
    };

function activePriceTime(
  entry: { isActive: boolean; priceYen: number | null; durationMinutes: number | null } | undefined,
): entry is { isActive: true; priceYen: number; durationMinutes: number } {
  return Boolean(entry?.isActive && entry.priceYen !== null && entry.durationMinutes !== null);
}

function safeAdd(left: number, right: number): number | null {
  const sum = left + right;
  return Number.isSafeInteger(sum) ? sum : null;
}

export function resolveWindowFilmV1Price(
  settings: WindowFilmSettingsV1,
  selection: WindowFilmPriceSelection,
  filmCoefficientBp: number,
): WindowFilmPriceResolution {
  if (!Number.isSafeInteger(filmCoefficientBp) || filmCoefficientBp < 1_000 || filmCoefficientBp > 50_000) {
    return { ok: false, reason: "INVALID_FILM_COEFFICIENT" };
  }
  if (selection.packageCode !== null && selection.areaCodes.length > 0) {
    return { ok: false, reason: "PACKAGE_AND_AREAS_SELECTED" };
  }
  if (selection.packageCode === null && selection.areaCodes.length === 0) {
    return { ok: false, reason: "NO_SCOPE_SELECTED" };
  }

  let basePriceYen = 0;
  let adjustedBasePriceYen = 0;
  let totalDurationMinutes = 0;
  if (selection.packageCode !== null) {
    const pkg = settings.packages.find((entry) => entry.code === selection.packageCode);
    if (!activePriceTime(pkg)) {
      return { ok: false, reason: "PACKAGE_NOT_CONFIGURED", code: selection.packageCode };
    }
    basePriceYen = pkg.priceYen;
    const adjustedNumerator = pkg.priceYen * filmCoefficientBp;
    if (!Number.isSafeInteger(adjustedNumerator)) return { ok: false, reason: "PRICE_OVERFLOW" };
    adjustedBasePriceYen = Math.round(adjustedNumerator / WINDOW_FILM_COEFFICIENT_BP_IDENTITY);
    if (!Number.isSafeInteger(adjustedBasePriceYen)) return { ok: false, reason: "PRICE_OVERFLOW" };
    totalDurationMinutes = pkg.durationMinutes;
  } else {
    const seen = new Set<string>();
    for (const code of selection.areaCodes) {
      if (seen.has(code)) return { ok: false, reason: "DUPLICATE_AREA", code };
      seen.add(code);
      const area = settings.areas[code as keyof typeof settings.areas];
      if (!activePriceTime(area)) return { ok: false, reason: "AREA_NOT_CONFIGURED", code };
      const adjustedNumerator = area.priceYen * filmCoefficientBp;
      if (!Number.isSafeInteger(adjustedNumerator)) return { ok: false, reason: "PRICE_OVERFLOW" };
      const adjustedLinePriceYen = Math.round(
        adjustedNumerator / WINDOW_FILM_COEFFICIENT_BP_IDENTITY,
      );
      const price = safeAdd(basePriceYen, area.priceYen);
      const adjustedPrice = safeAdd(adjustedBasePriceYen, adjustedLinePriceYen);
      const duration = safeAdd(totalDurationMinutes, area.durationMinutes);
      if (price === null || adjustedPrice === null || duration === null) {
        return { ok: false, reason: "PRICE_OVERFLOW" };
      }
      basePriceYen = price;
      adjustedBasePriceYen = adjustedPrice;
      totalDurationMinutes = duration;
    }
  }

  let optionPriceYen = 0;
  const seenOptions = new Set<string>();
  for (const selected of selection.options) {
    if (seenOptions.has(selected.code)) {
      return { ok: false, reason: "DUPLICATE_OPTION", code: selected.code };
    }
    seenOptions.add(selected.code);
    if (!Number.isSafeInteger(selected.quantity) || selected.quantity <= 0) {
      return { ok: false, reason: "INVALID_OPTION_QUANTITY", code: selected.code };
    }
    const option = settings.options.find((entry) => entry.code === selected.code);
    if (!activePriceTime(option)) {
      return { ok: false, reason: "OPTION_NOT_CONFIGURED", code: selected.code };
    }
    const extendedPrice = option.priceYen * selected.quantity;
    const extendedDuration = option.durationMinutes * selected.quantity;
    if (!Number.isSafeInteger(extendedPrice) || !Number.isSafeInteger(extendedDuration)) {
      return { ok: false, reason: "PRICE_OVERFLOW" };
    }
    const nextPrice = safeAdd(optionPriceYen, extendedPrice);
    const nextDuration = safeAdd(totalDurationMinutes, extendedDuration);
    if (nextPrice === null || nextDuration === null) return { ok: false, reason: "PRICE_OVERFLOW" };
    optionPriceYen = nextPrice;
    totalDurationMinutes = nextDuration;
  }

  const totalPriceYen = safeAdd(adjustedBasePriceYen, optionPriceYen);
  if (totalPriceYen === null) return { ok: false, reason: "PRICE_OVERFLOW" };
  return {
    ok: true,
    basePriceYen,
    filmCoefficientBp,
    adjustedBasePriceYen,
    optionPriceYen,
    totalPriceYen,
    totalDurationMinutes,
  };
}
