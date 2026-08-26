export const WINDOW_FILM_V1_CONTRACT_VERSION = "1.0" as const;

export const WINDOW_FILM_V1_AREA_CODES = [
  "front-windshield",
  "front-door-glass",
  "rear-door-glass",
  "triangular-window",
  "quarter-glass",
  "rear-glass",
  "sunroof",
] as const;

export type WindowFilmAreaCode = (typeof WINDOW_FILM_V1_AREA_CODES)[number];

export interface WindowFilmAreaSetting {
  priceYen: number | null;
  durationMinutes: number | null;
  isActive: boolean;
}

export interface WindowFilmCustomItem {
  code: string;
  name: string;
  priceYen: number | null;
  durationMinutes: number | null;
  isActive: boolean;
  displayOrder: number;
}

export interface WindowFilmSettingsV1 {
  contractVersion: typeof WINDOW_FILM_V1_CONTRACT_VERSION;
  revision: number;
  areas: Record<WindowFilmAreaCode, WindowFilmAreaSetting>;
  packages: WindowFilmCustomItem[];
  options: WindowFilmCustomItem[];
}

const TOP_LEVEL_KEYS = ["contractVersion", "revision", "areas", "packages", "options"] as const;
const AREA_KEYS = ["priceYen", "durationMinutes", "isActive"] as const;
const CUSTOM_ITEM_KEYS = [
  "code",
  "name",
  "priceYen",
  "durationMinutes",
  "isActive",
  "displayOrder",
] as const;
const STABLE_CODE = /^[a-z0-9][a-z0-9_-]{0,63}$/;

function fail(path: string, reason: string): never {
  throw new TypeError(`Invalid Window Film V1 contract at ${path}: ${reason}`);
}

function record(value: unknown, path: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    fail(path, "expected an object");
  }
  return value as Record<string, unknown>;
}

function exactKeys(value: Record<string, unknown>, expected: readonly string[], path: string): void {
  const actual = Object.keys(value);
  const missing = expected.filter((key) => !Object.prototype.hasOwnProperty.call(value, key));
  const extra = actual.filter((key) => !expected.includes(key));
  if (missing.length > 0) fail(path, `missing keys: ${missing.join(", ")}`);
  if (extra.length > 0) fail(path, `unknown keys: ${extra.join(", ")}`);
}

function nonNegativeIntegerOrNull(value: unknown, path: string): number | null {
  if (value === null) return null;
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    fail(path, "expected a non-negative safe integer or null");
  }
  return value;
}

function nonNegativeInteger(value: unknown, path: string): number {
  const parsed = nonNegativeIntegerOrNull(value, path);
  if (parsed === null) fail(path, "expected a non-negative safe integer");
  return parsed;
}

function bool(value: unknown, path: string): boolean {
  if (typeof value !== "boolean") fail(path, "expected a boolean");
  return value;
}

function activePair(
  priceYen: number | null,
  durationMinutes: number | null,
  isActive: boolean,
  path: string,
): void {
  if (isActive && (priceYen === null || durationMinutes === null)) {
    fail(path, "an active item requires both priceYen and durationMinutes");
  }
}

function parseArea(value: unknown, path: string): WindowFilmAreaSetting {
  const source = record(value, path);
  exactKeys(source, AREA_KEYS, path);
  const priceYen = nonNegativeIntegerOrNull(source.priceYen, `${path}.priceYen`);
  const durationMinutes = nonNegativeIntegerOrNull(
    source.durationMinutes,
    `${path}.durationMinutes`,
  );
  const isActive = bool(source.isActive, `${path}.isActive`);
  activePair(priceYen, durationMinutes, isActive, path);
  return { priceYen, durationMinutes, isActive };
}

function parseItems(value: unknown, path: string): WindowFilmCustomItem[] {
  if (!Array.isArray(value)) fail(path, "expected an array");
  const seen = new Set<string>();
  const activeNames = new Set<string>();
  const orders = new Set<number>();
  return value.map((entry, index) => {
    const itemPath = `${path}[${index}]`;
    const source = record(entry, itemPath);
    exactKeys(source, CUSTOM_ITEM_KEYS, itemPath);
    if (typeof source.code !== "string" || !STABLE_CODE.test(source.code)) {
      fail(`${itemPath}.code`, "expected a stable lowercase code");
    }
    if (seen.has(source.code)) fail(`${itemPath}.code`, "duplicate code");
    seen.add(source.code);
    if (typeof source.name !== "string" || source.name.trim() === "" || source.name !== source.name.trim()) {
      fail(`${itemPath}.name`, "expected a trimmed non-empty name");
    }
    const priceYen = nonNegativeIntegerOrNull(source.priceYen, `${itemPath}.priceYen`);
    const durationMinutes = nonNegativeIntegerOrNull(
      source.durationMinutes,
      `${itemPath}.durationMinutes`,
    );
    const isActive = bool(source.isActive, `${itemPath}.isActive`);
    const normalizedName = source.name.toLowerCase();
    if (isActive && activeNames.has(normalizedName)) {
      fail(`${itemPath}.name`, "duplicate active name after normalization");
    }
    if (isActive) activeNames.add(normalizedName);
    const displayOrder = nonNegativeInteger(source.displayOrder, `${itemPath}.displayOrder`);
    if (orders.has(displayOrder)) fail(`${itemPath}.displayOrder`, "duplicate display order");
    orders.add(displayOrder);
    activePair(priceYen, durationMinutes, isActive, itemPath);
    return {
      code: source.code,
      name: source.name,
      priceYen,
      durationMinutes,
      isActive,
      displayOrder,
    };
  });
}

/** Parse untrusted persisted JSON. No sample/default price is supplied here. */
export function parseWindowFilmSettingsV1(value: unknown): WindowFilmSettingsV1 {
  const source = record(value, "$windowFilm");
  exactKeys(source, TOP_LEVEL_KEYS, "$windowFilm");
  if (source.contractVersion !== WINDOW_FILM_V1_CONTRACT_VERSION) {
    fail("$windowFilm.contractVersion", `expected ${WINDOW_FILM_V1_CONTRACT_VERSION}`);
  }
  const areasSource = record(source.areas, "$windowFilm.areas");
  exactKeys(areasSource, WINDOW_FILM_V1_AREA_CODES, "$windowFilm.areas");
  const areas = Object.fromEntries(
    WINDOW_FILM_V1_AREA_CODES.map((code) => [
      code,
      parseArea(areasSource[code], `$windowFilm.areas.${code}`),
    ]),
  ) as Record<WindowFilmAreaCode, WindowFilmAreaSetting>;

  return {
    contractVersion: WINDOW_FILM_V1_CONTRACT_VERSION,
    revision: nonNegativeInteger(source.revision, "$windowFilm.revision"),
    areas,
    packages: parseItems(source.packages, "$windowFilm.packages"),
    options: parseItems(source.options, "$windowFilm.options"),
  };
}
