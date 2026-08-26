import {
  WINDOW_FILM_V1_AREA_CODES,
  parseWindowFilmSettingsV1,
  type WindowFilmAreaCode,
  type WindowFilmSettingsV1,
} from "./window-film-v1-contract";

export type StoredWindowFilmV1Resolution =
  | { status: "V1_READY"; settings: WindowFilmSettingsV1 }
  | { status: "LEGACY_REVIEW_REQUIRED"; legacy: unknown }
  | { status: "NOT_CONFIGURED" }
  | { status: "INVALID_STORED_PAYLOAD" };

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

const LEGACY_AREA_PRICE_MAP: Readonly<Record<string, WindowFilmAreaCode>> = {
  "wf-front-side": "front-door-glass",
  "wf-rear-side": "rear-door-glass",
  "wf-rear": "rear-glass",
  "wf-quarter": "quarter-glass",
};

function legacyPrice(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0
    ? value
    : null;
}

/** Build an unsaved, review-only V1 draft from the five unambiguous legacy prices. */
export function projectLegacyWindowFilmV1Draft(legacy: unknown): WindowFilmSettingsV1 | null {
  const legacyRoot = record(legacy);
  const basePrices = record(legacyRoot?.base_prices);
  if (!basePrices) return null;

  const areas = Object.fromEntries(
    WINDOW_FILM_V1_AREA_CODES.map((code) => [
      code,
      { priceYen: null, durationMinutes: null, isActive: false },
    ]),
  ) as WindowFilmSettingsV1["areas"];
  let mapped = false;
  for (const [legacyCode, areaCode] of Object.entries(LEGACY_AREA_PRICE_MAP)) {
    const priceYen = legacyPrice(basePrices[legacyCode]);
    if (priceYen === null) continue;
    areas[areaCode] = { priceYen, durationMinutes: null, isActive: false };
    mapped = true;
  }

  const packagePriceYen = legacyPrice(basePrices["wf-all"]);
  const packages = packagePriceYen === null
    ? []
    : [{
        code: "draft-package-legacy-wf-all",
        name: "全窓一括",
        priceYen: packagePriceYen,
        durationMinutes: null,
        isActive: false,
        displayOrder: 0,
      }];
  mapped ||= packagePriceYen !== null;

  return mapped
    ? { contractVersion: "1.0", revision: 0, areas, packages, options: [] }
    : null;
}

/** Resolve only window-film members; unrelated service settings are never returned or mutated. */
export function resolveStoredWindowFilmV1(
  servicePriceSettings: unknown,
): StoredWindowFilmV1Resolution {
  if (servicePriceSettings === null || servicePriceSettings === undefined) {
    return { status: "NOT_CONFIGURED" };
  }
  const root = record(servicePriceSettings);
  if (!root) return { status: "INVALID_STORED_PAYLOAD" };

  if (Object.prototype.hasOwnProperty.call(root, "window_film_v1")) {
    if (root.window_film_v1 === null) return { status: "NOT_CONFIGURED" };
    try {
      return { status: "V1_READY", settings: parseWindowFilmSettingsV1(root.window_film_v1) };
    } catch {
      return { status: "INVALID_STORED_PAYLOAD" };
    }
  }

  if (Object.prototype.hasOwnProperty.call(root, "window_film") && root.window_film !== null) {
    return { status: "LEGACY_REVIEW_REQUIRED", legacy: root.window_film };
  }
  return { status: "NOT_CONFIGURED" };
}
