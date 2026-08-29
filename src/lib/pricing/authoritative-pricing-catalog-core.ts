// EW-UI-4A2-1 — Strict authoritative PricingCatalog resolution — PURE CORE.
//
// No React, no server module, no Supabase, no DB, no `server-only`, no clock, no randomness, no
// `any`, no unsafe cast. Every dependency arrives through `PricingCatalogResolverDeps`, so this
// module is exhaustively testable under plain `node:test` without importing anything server-only.
//
// ── WHY THIS EXISTS ─────────────────────────────────────────────────────────────
// The pre-existing read path FAILS OPEN. `getDealerPricingCatalog()` returns DEFAULT_PRICING_CATALOG
// on ANY failure, and `getCanonicalDealerSettings()` coerces null/malformed pricing JSON to the
// hardcoded defaults. The wizard's only catalog-priced category (coating) would then be priced at
// default prices on a read failure. This module never coerces and never defaults on failure: any
// operational or malformed-data failure returns a typed result carrying NO catalog at all.
//
// ── STRICT SEMANTICS (architect-ratified) ───────────────────────────────────────
//   • A catalog is produced ONLY from a successful, authenticated read of an EXISTING row.
//   • `service_price_settings` / `ppf_price_tables` = null are VALID intentional defaults (the column
//     resolves to the canonical default). Both null ⇒ ok:true default catalog.
//   • `undefined` selected fields, arrays/non-objects in object positions, missing required
//     structural sections/containers, wrong nested types, numeric strings, booleans, NaN/Infinity,
//     negative prices, zero/negative coefficients, and duplicate item ids are MALFORMED.
//   • Prices are finite numbers ≥ 0 (explicit 0 is valid); coefficients/multipliers finite > 0.
//     No Number()/string→number/boolean→number/trim coercion anywhere.
//   • ID-keyed maps and item arrays may carry a valid SUBSET of canonical entries; an omitted
//     canonical entry retains its default value. Extra unknown properties are ignored and never
//     become pricing input. The result is always a COMPLETE PricingCatalog.
//
// It does NOT import getCanonicalDealerSettings, getDealerPricingCatalog, or
// dealerSettingsToPricingCatalog (the last catches conversion exceptions and returns {}, which would
// make strict failure detection impossible). DEFAULT_PRICING_CATALOG / makePricingCatalog are used
// ONLY on the success branch.

import {
  type PricingCatalog,
  DEFAULT_PRICING_CATALOG,
  makePricingCatalog,
} from "./pricing-catalog";
import { resolveStoredCoatingV34 } from "./coating-v34-persisted-payload";
import { parsePpfR1PriceSettings } from "./ppf-r1-price-contract";
import { parseWindowFilmSettingsV1 } from "./window-film-v1-contract";

/** Why no authoritative catalog could be produced. None is recoverable into a catalog. */
export type PricingCatalogResolutionFailure =
  | "no-dealer"     // no authenticated dealer membership — nothing to read a catalog for
  | "read-failed"   // the query/dealer lookup itself failed or threw
  | "no-row"        // authenticated read succeeded but the dealer has no settings row
  | "malformed";    // a stored value is structurally invalid — never coerced to a default

/** Discriminated: `catalog` exists ONLY on the success arm, so a failure cannot be read as a catalog. */
export type PricingCatalogResolution =
  | { readonly ok: true;  readonly catalog: PricingCatalog }
  | { readonly ok: false; readonly reason: PricingCatalogResolutionFailure };

/** The result of reading the two pricing columns. Distinguishes "read failed" from "read a null row". */
export type PricingSettingsReadResult =
  | {
      readonly ok: true;
      readonly row: {
        readonly service_price_settings: unknown;
        readonly ppf_price_tables: unknown;
      } | null;
    }
  | { readonly ok: false };

/**
 * Injected dependencies. Note what is NOT here: there is no `dealerId` argument and no catalog
 * argument. The dealer is discovered, never supplied; the catalog is derived, never asserted.
 */
export interface PricingCatalogResolverDeps {
  /** Resolve the authenticated dealer. `null` ⇒ no active membership. */
  readonly getDealerId: () => Promise<string | null>;
  /** Read the authenticated dealer's `service_price_settings` + `ppf_price_tables`. */
  readonly readPricingSettings: (dealerId: string) => Promise<PricingSettingsReadResult>;
}

// ── strict validation primitives (throw MALFORMED on any violation; caught by the resolver) ──
const MALFORMED = Symbol("malformed");
function bail(): never { throw MALFORMED; }

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
function reqObject(v: unknown): Record<string, unknown> {
  if (!isPlainObject(v)) bail();
  return v as Record<string, unknown>;
}
function reqArray(v: unknown): unknown[] {
  if (!Array.isArray(v)) bail();
  return v;
}
function reqString(v: unknown): string {
  if (typeof v !== "string") bail();
  return v;
}
/** Finite number ≥ 0. Explicit 0 is valid. No coercion: strings/booleans/NaN/Infinity/negatives fail. */
function reqPrice(v: unknown): number {
  if (typeof v !== "number" || !Number.isFinite(v) || v < 0) bail();
  return v;
}
/** Finite number > 0. Zero and negative coefficients fail. No coercion. */
function reqCoeff(v: unknown): number {
  if (typeof v !== "number" || !Number.isFinite(v) || v <= 0) bail();
  return v;
}
function reqBoolean(v: unknown): boolean {
  if (typeof v !== "boolean") bail();
  return v;
}
/** A required, non-blank identifier or name (trim must be non-empty). */
function reqNonBlankString(v: unknown): string {
  if (typeof v !== "string" || v.trim() === "") bail();
  return v;
}
/**
 * Read a top-level legacy service section that is optional under V3.4: absent or explicit `null`
 * means "no override" for that family (returns `undefined`); any other present value must be a
 * plain object, which the caller then runs through the SAME complete validation as before this
 * change — a present malformed section still fails the entire catalog closed via `bail()`.
 */
function optionalSection(
  spc: Record<string, unknown>,
  key: string,
): Record<string, unknown> | undefined {
  if (!Object.prototype.hasOwnProperty.call(spc, key) || spc[key] === null) return undefined;
  return reqObject(spc[key]);
}

/** Validate EVERY entry (own enumerable) of a stored map, including entries under non-canonical ids. */
function validateStringMap(map: Record<string, unknown>): void {
  for (const [, v] of Object.entries(map)) reqString(v);
}
function validatePriceMap(map: Record<string, unknown>): void {
  for (const [, v] of Object.entries(map)) reqPrice(v);
}
function validateCoeffMap(map: Record<string, unknown>): void {
  for (const [, v] of Object.entries(map)) reqCoeff(v);
}

/** A fully-validated dealer menu (id/name non-blank, price finite ≥ 0). Duplicate ids MALFORMED. */
function validateMenus(menusRaw: unknown): { id: string; name: string; price: number }[] {
  const arr = reqArray(menusRaw);
  const seen = new Set<string>();
  const out: { id: string; name: string; price: number }[] = [];
  for (const m of arr) {
    const mo = reqObject(m);
    const id = reqNonBlankString(mo.id);
    const name = reqNonBlankString(mo.name);
    const price = reqPrice(mo.price);
    if (seen.has(id)) bail();
    seen.add(id);
    out.push({ id, name, price });
  }
  return out;
}

/**
 * Overlay a numeric field onto canonical default items, keyed by `idKey`. An omitted key keeps the
 * default item unchanged; a present-but-invalid value is MALFORMED. Extra input keys are ignored.
 */
function overlay<T extends object>(
  defaults: readonly T[],
  idKey: keyof T,
  map: Record<string, unknown>,
  field: keyof T,
  validate: (v: unknown) => number,
): T[] {
  return defaults.map((d) => {
    const raw = map[d[idKey] as unknown as string];
    return raw === undefined ? d : ({ ...d, [field]: validate(raw) } as T);
  });
}

/** Overlay validated dealer menus (require full item schema) onto canonical default menus by id. */
function overlayMenus(
  defaults: readonly { id: string; name: string; price: number }[],
  items: readonly { id: string; name: string; price: number }[],
): { id: string; name: string; price: number }[] {
  const byId = new Map(items.map((i) => [i.id, i]));
  return defaults.map((d) => {
    const e = byId.get(d.id);
    return e ? { ...d, name: e.name, price: e.price } : d;
  });
}

/**
 * Apply a `service_price_settings` object onto the catalog overrides. Coating (V3.4) is mandatory
 * whenever this object is non-null. The five legacy sections — `ppf`, `window_film`, `maintenance`,
 * `carwash`, `room_cleaning` — are each optional: absent or explicit `null` means no override for
 * that family and the corresponding `DEFAULT_PRICING_CATALOG` values pass through unchanged (this is
 * the natural coating-only shape `save_coating_v34_settings` writes). A PRESENT non-null section
 * still runs the COMPLETE stored-schema validation it always did (every container, array item, and
 * map entry — including entries under non-canonical ids) before any canonical-id overlay is applied.
 */
function applyServiceOverrides(spcRaw: unknown, out: Partial<PricingCatalog>): void {
  const spc = reqObject(spcRaw);
  const ppf = optionalSection(spc, "ppf");
  const window_film = optionalSection(spc, "window_film");
  const maintenance = optionalSection(spc, "maintenance");
  const carwash = optionalSection(spc, "carwash");
  const room_cleaning = optionalSection(spc, "room_cleaning");

  // ── coating: the V3.4 seven-size direct-price contract is the ONLY authoritative coating
  // source. Legacy scalar/multiplier data, an unresolved legacy-review candidate, an invalid
  // payload, and absent coating data all fail the ENTIRE catalog resolution closed via `bail()` —
  // never a silent legacy price, never a size-multiplier fallback, never a default catalog.
  const coatingResolution = resolveStoredCoatingV34(spc);
  if (coatingResolution.status !== "V34_READY") bail();
  const coatingV34 = coatingResolution.settings;
  out.coatingV34 = coatingV34;
  // Canonical coating product identity/labels, rank gating, and the compatibility matrix stay on
  // DEFAULT_PRICING_CATALOG.coatings — the V3.4 payload carries prices only, never name/grade.
  out.coatingOptions = overlay(
    DEFAULT_PRICING_CATALOG.coatingOptions,
    "id",
    coatingV34.option_prices,
    "price",
    reqPrice,
  );

  // ── ppf service overview: labels only, but fully validated when present ──
  if (ppf !== undefined) {
    reqBoolean(ppf.active);
    const planLabels = reqObject(ppf.plan_labels);
    validateStringMap(planLabels);
  }

  // ── window film ──
  const wfBase = window_film !== undefined ? reqObject(window_film.base_prices) : {};
  const wfGrade = window_film !== undefined ? reqObject(window_film.grade_coeff) : {};
  validatePriceMap(wfBase);
  validateCoeffMap(wfGrade);

  // ── menus: full item schema (id/name non-blank, price ≥ 0) ──
  const maintMenus = maintenance !== undefined ? validateMenus(maintenance.menus) : [];
  const washMenus = carwash !== undefined ? validateMenus(carwash.menus) : [];

  // ── room cleaning ──
  const rcBase = room_cleaning !== undefined ? reqObject(room_cleaning.base_prices) : {};
  const rcCond = room_cleaning !== undefined ? reqObject(room_cleaning.condition_coeff) : {};
  validatePriceMap(rcBase);
  validateCoeffMap(rcCond);

  // ── overlays (every input already fully validated) ──
  out.windowParts = overlay(DEFAULT_PRICING_CATALOG.windowParts, "id", wfBase, "basePrice", reqPrice);
  out.windowGrades = overlay(DEFAULT_PRICING_CATALOG.windowGrades, "id", wfGrade, "coeff", reqCoeff);
  if (Object.prototype.hasOwnProperty.call(spc, "window_film_v1")) {
    if (spc.window_film_v1 === null) {
      out.windowFilmV1 = null;
    } else {
      try {
        out.windowFilmV1 = parseWindowFilmSettingsV1(spc.window_film_v1);
      } catch {
        bail();
      }
    }
  }
  out.maintenanceMenus = overlayMenus(DEFAULT_PRICING_CATALOG.maintenanceMenus, maintMenus);
  out.carwashMenus = overlayMenus(DEFAULT_PRICING_CATALOG.carwashMenus, washMenus);
  out.roomCleanParts = overlay(DEFAULT_PRICING_CATALOG.roomCleanParts, "id", rcBase, "basePrice", reqPrice);
  out.roomCleanConditions = overlay(DEFAULT_PRICING_CATALOG.roomCleanConditions, "id", rcCond, "coeff", reqCoeff);
}

/** Apply a validated `ppf_price_tables` object (its five required map containers) onto the overrides. */
function applyPpfOverrides(ppfRaw: unknown, out: Partial<PricingCatalog>): void {
  const t = reqObject(ppfRaw);

  // C4B2 transition boundary: a versioned R1 payload is the ONLY value exposed
  // through `catalog.ppfR1`. The legacy five-map payload remains readable only
  // for non-wizard compatibility during rollout; it never populates ppfR1 and
  // therefore cannot become a hidden fallback in the live wizard.
  if (Object.prototype.hasOwnProperty.call(t, "contractVersion")) {
    try {
      out.ppfR1 = parsePpfR1PriceSettings(t);
      return;
    } catch {
      bail();
    }
  }

  const planPricesRaw = reqObject(t.plan_prices);
  const filmCoeff = reqObject(t.film_coeff);
  const rankCoeff = reqObject(t.rank_coeff);
  const glassPrices = reqObject(t.glass_prices);
  const partsPrices = reqObject(t.parts_prices);
  // Validate EVERY entry, including entries under non-canonical ids.
  validateCoeffMap(filmCoeff);
  validateCoeffMap(rankCoeff);
  validatePriceMap(glassPrices);
  validatePriceMap(partsPrices);

  // plan_prices — flat "<plan>_<size>" keys → nested plan→size table (may ADD entries). Each key must
  // split into a NON-EMPTY plan and a NON-EMPTY size ("front-half_", "_M", "front-half" all reject).
  const planPrices: Record<string, Record<string, number>> = {};
  for (const [plan, sizes] of Object.entries(DEFAULT_PRICING_CATALOG.ppfPlanPrices)) {
    planPrices[plan] = { ...sizes };
  }
  for (const [key, v] of Object.entries(planPricesRaw)) {
    const price = reqPrice(v);
    const idx = key.lastIndexOf("_");
    const plan = idx >= 0 ? key.slice(0, idx) : "";
    const size = idx >= 0 ? key.slice(idx + 1) : "";
    if (idx < 0 || plan === "" || size === "") bail();
    if (!planPrices[plan]) planPrices[plan] = {};
    planPrices[plan][size] = price;
  }
  out.ppfPlanPrices = planPrices;

  out.ppfFilmTypes = overlay(DEFAULT_PRICING_CATALOG.ppfFilmTypes, "id", filmCoeff, "coeff", reqCoeff);
  out.ppfVehicleRanks = overlay(DEFAULT_PRICING_CATALOG.ppfVehicleRanks, "id", rankCoeff, "coeff", reqCoeff);
  out.ppfFrontGlass = overlay(DEFAULT_PRICING_CATALOG.ppfFrontGlass, "id", glassPrices, "price", reqPrice);
  out.ppfSingleParts = overlay(DEFAULT_PRICING_CATALOG.ppfSingleParts, "id", partsPrices, "price", reqPrice);
}

/**
 * Build a COMPLETE PricingCatalog from raw column values. Throws MALFORMED on any invalid stored
 * value (or on a hostile getter). null columns are valid intentional defaults; undefined columns
 * (an absent selected field) are malformed.
 */
function buildStrictCatalog(spcRaw: unknown, ppfRaw: unknown): PricingCatalog {
  if (spcRaw === undefined || ppfRaw === undefined) bail(); // a selected column was not returned
  const overrides: Partial<PricingCatalog> = {};
  if (spcRaw !== null) applyServiceOverrides(spcRaw, overrides);
  if (ppfRaw !== null) applyPpfOverrides(ppfRaw, overrides);
  // null column ⇒ no override for that column ⇒ canonical defaults. Always a complete catalog.
  return makePricingCatalog(overrides);
}

/**
 * Resolve the authoritative PricingCatalog, fail-closed at every step.
 *
 * A thrown dealer lookup or read is `"read-failed"`; a thrown/malformed stored value is
 * `"malformed"`. There is no branch that produces a catalog from an operational or malformed-data
 * failure — the catalog exists ONLY on the success arm.
 */
export async function resolveAuthoritativePricingCatalog(
  deps: PricingCatalogResolverDeps,
): Promise<PricingCatalogResolution> {
  let dealerId: string | null;
  try {
    dealerId = await deps.getDealerId();
  } catch {
    return { ok: false, reason: "read-failed" };
  }
  if (dealerId === null || typeof dealerId !== "string" || dealerId.trim() === "") {
    return { ok: false, reason: "no-dealer" };
  }

  let read: PricingSettingsReadResult;
  try {
    read = await deps.readPricingSettings(dealerId);
  } catch {
    return { ok: false, reason: "read-failed" };
  }
  if (!read.ok) return { ok: false, reason: "read-failed" };
  if (read.row === null) return { ok: false, reason: "no-row" };

  // Column value access + validation are inside one guard: a malformed value OR a hostile getter
  // both fail closed to "malformed" — never a throw, never a default.
  try {
    const catalog = buildStrictCatalog(read.row.service_price_settings, read.row.ppf_price_tables);
    return { ok: true, catalog };
  } catch {
    return { ok: false, reason: "malformed" };
  }
}
