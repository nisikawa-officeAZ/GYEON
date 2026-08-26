export interface WindowFilmTypeSetting {
  itemId: string | null;
  code: string | null;
  name: string;
  installationCoefficientBp: number;
  irCutPercent: number | null;
  uvCutPercent: number | null;
  isActive: boolean;
  displayOrder: number;
  expectedUpdatedAt: string | null;
}

/** Read model permits a legacy row whose coefficient has not been confirmed yet. */
export type WindowFilmTypeReadSetting = Omit<WindowFilmTypeSetting, "installationCoefficientBp"> & {
  installationCoefficientBp: number | null;
};

const KEYS = [
  "itemId",
  "code",
  "name",
  "installationCoefficientBp",
  "irCutPercent",
  "uvCutPercent",
  "isActive",
  "displayOrder",
  "expectedUpdatedAt",
] as const;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CODE = /^film-[a-z0-9-]{1,80}$/;

function fail(path: string, message: string): never {
  throw new TypeError(`Invalid Window Film type at ${path}: ${message}`);
}

function nullableString(value: unknown, path: string, pattern?: RegExp): string | null {
  if (value === null) return null;
  if (typeof value !== "string" || value.trim() === "" || value !== value.trim()) {
    fail(path, "expected a trimmed string or null");
  }
  if (pattern && !pattern.test(value)) fail(path, "invalid format");
  return value;
}

function nullablePercent(value: unknown, path: string): number | null {
  if (value === null) return null;
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > 100) {
    fail(path, "expected an integer from 0 to 100 or null");
  }
  return value;
}

export function parseWindowFilmTypes(value: unknown): WindowFilmTypeSetting[] {
  if (!Array.isArray(value)) fail("$filmTypes", "expected an array");
  const ids = new Set<string>();
  const codes = new Set<string>();
  const activeNames = new Set<string>();
  const orders = new Set<number>();
  return value.map((entry, index) => {
    const path = `$filmTypes[${index}]`;
    if (entry === null || typeof entry !== "object" || Array.isArray(entry)) fail(path, "expected an object");
    const source = entry as Record<string, unknown>;
    const actual = Object.keys(source);
    const missing = KEYS.filter((key) => !Object.prototype.hasOwnProperty.call(source, key));
    const extra = actual.filter((key) => !KEYS.includes(key as (typeof KEYS)[number]));
    if (missing.length || extra.length) fail(path, `keys mismatch: missing=${missing.join(",")} extra=${extra.join(",")}`);

    const itemId = nullableString(source.itemId, `${path}.itemId`, UUID);
    const code = nullableString(source.code, `${path}.code`, CODE);
    if ((itemId === null) !== (code === null)) fail(path, "itemId and code must both exist or both be null");
    if (itemId && ids.has(itemId)) fail(`${path}.itemId`, "duplicate item ID");
    if (code && codes.has(code)) fail(`${path}.code`, "duplicate code");
    if (itemId) ids.add(itemId);
    if (code) codes.add(code);

    if (typeof source.name !== "string" || source.name.trim() === "" || source.name !== source.name.trim() || source.name.length > 200) {
      fail(`${path}.name`, "expected a trimmed name up to 200 characters");
    }
    if (typeof source.installationCoefficientBp !== "number"
      || !Number.isInteger(source.installationCoefficientBp)
      || source.installationCoefficientBp < 1_000
      || source.installationCoefficientBp > 50_000) {
      fail(`${path}.installationCoefficientBp`, "expected 1000..50000 basis points");
    }
    if (typeof source.isActive !== "boolean") fail(`${path}.isActive`, "expected a boolean");
    const normalizedName = source.name.toLowerCase();
    if (source.isActive && activeNames.has(normalizedName)) {
      fail(`${path}.name`, "duplicate active name after normalization");
    }
    if (source.isActive) activeNames.add(normalizedName);
    if (typeof source.displayOrder !== "number" || !Number.isInteger(source.displayOrder) || source.displayOrder < 0 || source.displayOrder > 100_000) {
      fail(`${path}.displayOrder`, "expected 0..100000");
    }
    if (orders.has(source.displayOrder)) fail(`${path}.displayOrder`, "duplicate display order");
    orders.add(source.displayOrder);
    const expectedUpdatedAt = nullableString(source.expectedUpdatedAt, `${path}.expectedUpdatedAt`);
    if (expectedUpdatedAt !== null && Number.isNaN(Date.parse(expectedUpdatedAt))) {
      fail(`${path}.expectedUpdatedAt`, "expected an ISO timestamp or null");
    }
    return {
      itemId,
      code,
      name: source.name,
      installationCoefficientBp: source.installationCoefficientBp,
      irCutPercent: nullablePercent(source.irCutPercent, `${path}.irCutPercent`),
      uvCutPercent: nullablePercent(source.uvCutPercent, `${path}.uvCutPercent`),
      isActive: source.isActive,
      displayOrder: source.displayOrder,
      expectedUpdatedAt,
    };
  });
}
