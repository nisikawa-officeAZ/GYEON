// EW-UI-5A1-B3 — Runtime validation of an untrusted save intent (PURE).
//
// `raw: unknown` → a fully RECONSTRUCTED `WizardSaveIntent`, or a list of structural issues.
// No "use server", no server-only, no Supabase, no React, no route, no clock, no randomness, no
// dependency (no Zod), no fixture/default draft.
//
// ── WHY RECONSTRUCTION, NOT TYPE GUARDS ─────────────────────────────────────────
// A guard chain narrows `unknown` to a structurally compatible type, but for a nine-section nested
// object it must terminate in `raw as WizardSaveIntent` or a `raw is WizardSaveIntent` predicate —
// and a whole-object `is` predicate is an unchecked assertion wearing a different hat. This module
// instead READS each accepted field once and BUILDS a new object, so the result's type is INFERRED
// from literals and validated locals. `as WizardSaveIntent` / `as EstimateWizardDraftV22` appear
// nowhere, and neither does `any`, `@ts-ignore`, or `@ts-expect-error`.
//
// Reconstruction also buys two properties a guard cannot:
//   • EXTRA KEYS CANNOT SURVIVE. `raw` crosses a Server Action deserialization boundary. A guard
//     passes an object carrying additional properties, which then flow into the save mapper and into
//     `EstimateSaveMetadata`. The output here contains only audited fields — and unexpected keys are
//     rejected outright rather than merely dropped, so a client attempting to smuggle `dealerId`,
//     `pricing`, or `role` gets a hard failure instead of silent success.
//   • HOSTILE GETTERS CANNOT SPLIT. A guard reads a property to test it and the consumer reads it
//     again later; a getter returning different values on the two reads is a TOCTOU hole. Every
//     property here is read EXACTLY ONCE into a local, and that local is what gets stored.
//
// ── THE OUTER CATCH ─────────────────────────────────────────────────────────────
// One defensive `try/catch` wraps the whole walk, solely to convert a THROWING getter or proxy trap
// into `unreadable-input`. It is not the validation algorithm: every field below is checked
// explicitly and structurally, and removing the catch would change only how a hostile property
// ACCESS is reported — never whether a malformed value is caught.

import { isServiceCategoryId, type ServiceCategoryId } from "@/lib/estimates/service-categories";
import type { EstimateWizardDraftV22 } from "../draft/wizard-draft-types";
import type {
  DiscountMode, InteriorPpfRow, LayerCount, NewCustomerDraft, NewVehicleDraft,
  OtherWorkCustomRow, PpfInstallationMethodId,
} from "../screens/step-types";
import {
  IDEMPOTENCY_KEY_PATTERN, WIZARD_SAVE_INTENT_ROOT_KEYS,
  type WizardSaveIntentIssueCode, type WizardSaveIntentValidation, type WizardSaveIntentValidationIssue,
} from "./wizard-save-intent-types";

// ── Issue collection ─────────────────────────────────────────────────────────
//
// ── PATHS ARE SCHEMA-DERIVED, NEVER INPUT-DERIVED ───────────────────────────────
// `issue.path` is returned to the caller through the Server Action, so ANY untrusted text placed in
// it becomes client-visible free text. A key name is untrusted text: `{ "<script>": 1 }` or
// `{ "090-1234-5678": 1 }` would otherwise be echoed straight back inside the path.
//
// Therefore a path segment may only ever come from:
//   • a literal spelled in THIS file (a schema field name), or
//   • the fixed wildcard `*`, standing for "some key/element at this location".
//
// Nothing else is permitted. Unexpected object keys, record entry keys, prototype-pollution keys and
// array element indices ALL collapse to `*`. Indices are included because their range is chosen by
// the attacker, not by the schema: without collapsing, a one-million-element array of malformed rows
// would emit one million issues across the action boundary and leak the exact shape of the input.
//
// ── ONE ISSUE PER (path, code) ──────────────────────────────────────────────────
// Collapsing to `*` makes repeats inevitable, so issues are DEDUPED on (path, code). This keeps the
// report deterministic — the same structural defect yields the same single issue regardless of how
// many keys or elements triggered it — and bounds the output size by the schema, not by the input.

type Issues = {
  readonly list: WizardSaveIntentValidationIssue[];
  readonly seen: Set<string>;
};

const newIssues = (): Issues => ({ list: [], seen: new Set<string>() });

/** The ONLY non-literal path segment permitted: an unnamed key or element at a known location. */
const ANY_KEY = "*";

const add = (issues: Issues, path: string, code: WizardSaveIntentIssueCode): undefined => {
  const dedupeKey = `${path}\u0000${code}`;
  if (!issues.seen.has(dedupeKey)) {
    issues.seen.add(dedupeKey);
    issues.list.push({ path, code });
  }
  return undefined;
};

// ── Structural primitives ────────────────────────────────────────────────────

/**
 * A PLAIN object: not null, not an array, and carrying either `Object.prototype` or a null prototype.
 * Rejecting exotic prototypes keeps class instances and prototype-rigged objects out of a boundary
 * that is supposed to receive deserialized data only.
 */
function isPlainObject(v: unknown): v is Record<string, unknown> {
  if (typeof v !== "object" || v === null || Array.isArray(v)) return false;
  const proto: unknown = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
}

/** Keys that must never be copied into a reconstructed record — prototype-pollution vectors. */
const POLLUTION_KEYS = ["__proto__", "constructor", "prototype"];

function readObject(v: unknown, path: string, issues: Issues): Record<string, unknown> | undefined {
  if (v === undefined) return add(issues, path, "missing-field");
  if (!isPlainObject(v)) return add(issues, path, "invalid-type");
  return v;
}

/**
 * Require an EXACT key set. Missing keys and unexpected keys are reported separately, so a client
 * sending `dealerId` / `pricing` / `role` is told the field is unexpected rather than being silently
 * ignored. `optional` keys are permitted but never required.
 */
function requireExactKeys(
  o: Record<string, unknown>, path: string, required: readonly string[], issues: Issues,
  optional: readonly string[] = [],
): void {
  const allowed = new Set<string>([...required, ...optional]);
  for (const k of Object.keys(o)) {
    // The offending key is UNTRUSTED text and must never reach the path. One deduped wildcard
    // issue reports "this object carries a key the schema does not define".
    if (!allowed.has(k)) add(issues, `${path}.${ANY_KEY}`, "unexpected-field");
  }
  // A MISSING key is named by the schema, not by the input, so its exact path is safe and useful.
  for (const k of required) {
    if (!Object.prototype.hasOwnProperty.call(o, k)) add(issues, `${path}.${k}`, "missing-field");
  }
}

// ── Scalar readers (NO coercion anywhere) ────────────────────────────────────

function readString(v: unknown, path: string, issues: Issues): string | undefined {
  if (v === undefined) return add(issues, path, "missing-field");
  if (typeof v !== "string") return add(issues, path, "invalid-type");
  return v;
}
function readBoolean(v: unknown, path: string, issues: Issues): boolean | undefined {
  if (v === undefined) return add(issues, path, "missing-field");
  if (typeof v !== "boolean") return add(issues, path, "invalid-type");
  return v;
}
/** `string | null`: null is a VALID value here, undefined/absent is not. */
function readNullableString(v: unknown, path: string, issues: Issues): string | null | undefined {
  if (v === undefined) return add(issues, path, "missing-field");
  if (v === null) return null;
  if (typeof v !== "string") return add(issues, path, "invalid-type");
  return v;
}
/** An OPTIONAL string: absent is valid, `null` is NOT (the source type is `string | undefined`). */
function readOptionalString(v: unknown, path: string, issues: Issues): string | undefined {
  if (v === undefined) return undefined;
  if (typeof v !== "string") { add(issues, path, "invalid-type"); return undefined; }
  return v;
}
/** A finite, non-negative safe integer. No coercion: `"3"`, `true`, `1.5`, `NaN`, `Infinity` all fail. */
function readCount(v: unknown, path: string, issues: Issues): number | undefined {
  if (v === undefined) return add(issues, path, "missing-field");
  if (typeof v !== "number") return add(issues, path, "invalid-type");
  if (!Number.isSafeInteger(v) || v < 0) return add(issues, path, "invalid-number");
  return v;
}

function readLiteral<T extends string>(
  v: unknown, path: string, allowed: readonly T[], issues: Issues,
): T | undefined {
  if (v === undefined) return add(issues, path, "missing-field");
  if (typeof v !== "string") return add(issues, path, "invalid-type");
  const hit = allowed.find((a) => a === v);
  if (hit === undefined) return add(issues, path, "invalid-literal");
  return hit; // the matched LITERAL from `allowed` — narrow by construction, never a cast
}

function readNullableLiteral<T extends string>(
  v: unknown, path: string, allowed: readonly T[], issues: Issues,
): T | null | undefined {
  if (v === null) return null;
  return readLiteral(v, path, allowed, issues);
}

// ── Collection readers (every one returns a FRESH copy) ──────────────────────

function readStringArray(v: unknown, path: string, issues: Issues): string[] | undefined {
  if (v === undefined) return add(issues, path, "missing-field");
  if (!Array.isArray(v)) return add(issues, path, "invalid-type");
  const elementPath = `${path}[${ANY_KEY}]`;
  const out: string[] = [];
  let ok = true;
  for (let i = 0; i < v.length; i += 1) {
    const s = readString(v[i], elementPath, issues);
    if (s === undefined) { ok = false; continue; }
    out.push(s);
  }
  return ok ? out : undefined;
}

/**
 * `Record<string, string>` — a fresh object; pollution keys are rejected, never copied.
 *
 * Record keys are operator-authored identifiers (menu ids, option ids), i.e. fully untrusted text.
 * Every entry-level issue is therefore reported at the wildcard path and deduped: one
 * `unitPricesByMenu.* / invalid-type` issue regardless of how many entries are malformed.
 */
function readStringRecord(v: unknown, path: string, issues: Issues): Record<string, string> | undefined {
  const o = readObject(v, path, issues);
  if (o === undefined) return undefined;
  const entryPath = `${path}.${ANY_KEY}`;
  const out: Record<string, string> = {};
  let ok = true;
  for (const k of Object.keys(o)) {
    if (POLLUTION_KEYS.includes(k)) { add(issues, entryPath, "unexpected-field"); ok = false; continue; }
    const s = readString(o[k], entryPath, issues);
    if (s === undefined) { ok = false; continue; }
    Object.defineProperty(out, k, { value: s, writable: true, enumerable: true, configurable: true });
  }
  return ok ? out : undefined;
}

/** `Record<string, number>` — finite, non-negative safe integers only. Wildcard entry paths. */
function readNumberRecord(v: unknown, path: string, issues: Issues): Record<string, number> | undefined {
  const o = readObject(v, path, issues);
  if (o === undefined) return undefined;
  const entryPath = `${path}.${ANY_KEY}`;
  const out: Record<string, number> = {};
  let ok = true;
  for (const k of Object.keys(o)) {
    if (POLLUTION_KEYS.includes(k)) { add(issues, entryPath, "unexpected-field"); ok = false; continue; }
    const n = readCount(o[k], entryPath, issues);
    if (n === undefined) { ok = false; continue; }
    Object.defineProperty(out, k, { value: n, writable: true, enumerable: true, configurable: true });
  }
  return ok ? out : undefined;
}

/** A homogeneous array of reconstructed rows. */
function readRowArray<T>(
  v: unknown, path: string, issues: Issues, readRow: (raw: unknown, p: string, i: Issues) => T | undefined,
): T[] | undefined {
  if (v === undefined) return add(issues, path, "missing-field");
  if (!Array.isArray(v)) return add(issues, path, "invalid-type");
  const elementPath = `${path}[${ANY_KEY}]`;
  const out: T[] = [];
  let ok = true;
  for (let i = 0; i < v.length; i += 1) {
    const row = readRow(v[i], elementPath, issues);
    if (row === undefined) { ok = false; continue; }
    out.push(row);
  }
  return ok ? out : undefined;
}

// ── Draft leaf shapes ────────────────────────────────────────────────────────

const NEW_CUSTOMER_REQUIRED = [
  "name", "phone", "email", "postal", "address", "lineId",
  "isBusiness", "tradeRate", "arAllowed", "closingDay", "paymentDay",
] as const;
/** `kana` / `creditTerms` are `string | undefined` in the source type — absent is fine, null is NOT. */
const NEW_CUSTOMER_OPTIONAL = ["kana", "creditTerms"] as const;

function readNewCustomer(v: unknown, path: string, issues: Issues): NewCustomerDraft | undefined {
  const o = readObject(v, path, issues);
  if (o === undefined) return undefined;
  requireExactKeys(o, path, NEW_CUSTOMER_REQUIRED, issues, NEW_CUSTOMER_OPTIONAL);

  const name = readString(o.name, `${path}.name`, issues);
  const phone = readString(o.phone, `${path}.phone`, issues);
  const email = readString(o.email, `${path}.email`, issues);
  const postal = readString(o.postal, `${path}.postal`, issues);
  const address = readString(o.address, `${path}.address`, issues);
  const lineId = readString(o.lineId, `${path}.lineId`, issues);
  const isBusiness = readBoolean(o.isBusiness, `${path}.isBusiness`, issues);
  const tradeRate = readString(o.tradeRate, `${path}.tradeRate`, issues);
  const arAllowed = readBoolean(o.arAllowed, `${path}.arAllowed`, issues);
  const closingDay = readString(o.closingDay, `${path}.closingDay`, issues);
  const paymentDay = readString(o.paymentDay, `${path}.paymentDay`, issues);
  // Present-but-null must FAIL (the field is optional, not nullable).
  const hasKana = Object.prototype.hasOwnProperty.call(o, "kana");
  const hasCredit = Object.prototype.hasOwnProperty.call(o, "creditTerms");
  if (hasKana && o.kana === null) add(issues, `${path}.kana`, "invalid-type");
  if (hasCredit && o.creditTerms === null) add(issues, `${path}.creditTerms`, "invalid-type");
  const kana = readOptionalString(o.kana, `${path}.kana`, issues);
  const creditTerms = readOptionalString(o.creditTerms, `${path}.creditTerms`, issues);

  if (
    name === undefined || phone === undefined || email === undefined || postal === undefined ||
    address === undefined || lineId === undefined || isBusiness === undefined || tradeRate === undefined ||
    arAllowed === undefined || closingDay === undefined || paymentDay === undefined
  ) return undefined;

  const base = {
    name, phone, email, postal, address, lineId,
    isBusiness, tradeRate, arAllowed, closingDay, paymentDay,
  };
  // Optional keys are re-added ONLY when the input actually carried a string, so an absent field
  // stays absent rather than becoming an explicit `undefined` property.
  if (kana !== undefined && creditTerms !== undefined) return { ...base, kana, creditTerms };
  if (kana !== undefined) return { ...base, kana };
  if (creditTerms !== undefined) return { ...base, creditTerms };
  return base;
}

const NEW_VEHICLE_KEYS = [
  "maker", "model", "grade", "vehicle_code", "vin", "first_registration_year_month",
  "registration_date", "inspection_expiry_date", "displacement", "color", "plate_number",
] as const;

function readNewVehicle(v: unknown, path: string, issues: Issues): NewVehicleDraft | undefined {
  const o = readObject(v, path, issues);
  if (o === undefined) return undefined;
  requireExactKeys(o, path, NEW_VEHICLE_KEYS, issues);

  const maker = readString(o.maker, `${path}.maker`, issues);
  const model = readString(o.model, `${path}.model`, issues);
  const grade = readString(o.grade, `${path}.grade`, issues);
  const vehicleCode = readString(o.vehicle_code, `${path}.vehicle_code`, issues);
  const vin = readString(o.vin, `${path}.vin`, issues);
  const firstReg = readString(o.first_registration_year_month, `${path}.first_registration_year_month`, issues);
  const regDate = readString(o.registration_date, `${path}.registration_date`, issues);
  const inspExpiry = readString(o.inspection_expiry_date, `${path}.inspection_expiry_date`, issues);
  const displacement = readString(o.displacement, `${path}.displacement`, issues);
  const color = readString(o.color, `${path}.color`, issues);
  const plateNumber = readString(o.plate_number, `${path}.plate_number`, issues);

  if (
    maker === undefined || model === undefined || grade === undefined || vehicleCode === undefined ||
    vin === undefined || firstReg === undefined || regDate === undefined || inspExpiry === undefined ||
    displacement === undefined || color === undefined || plateNumber === undefined
  ) return undefined;

  return {
    maker, model, grade,
    vehicle_code: vehicleCode,
    vin,
    first_registration_year_month: firstReg,
    registration_date: regDate,
    inspection_expiry_date: inspExpiry,
    displacement, color,
    plate_number: plateNumber,
  };
}

const INTERIOR_ROW_KEYS = ["id", "location", "amount"] as const;
function readInteriorRow(v: unknown, path: string, issues: Issues): InteriorPpfRow | undefined {
  const o = readObject(v, path, issues);
  if (o === undefined) return undefined;
  requireExactKeys(o, path, INTERIOR_ROW_KEYS, issues);
  const id = readString(o.id, `${path}.id`, issues);
  const location = readString(o.location, `${path}.location`, issues);
  const amount = readString(o.amount, `${path}.amount`, issues);
  if (id === undefined || location === undefined || amount === undefined) return undefined;
  return { id, location, amount };
}

const CUSTOM_ROW_KEYS = ["id", "name", "description", "unitPrice", "quantity", "unitLabel"] as const;
function readCustomRow(v: unknown, path: string, issues: Issues): OtherWorkCustomRow | undefined {
  const o = readObject(v, path, issues);
  if (o === undefined) return undefined;
  requireExactKeys(o, path, CUSTOM_ROW_KEYS, issues);
  const id = readString(o.id, `${path}.id`, issues);
  const name = readString(o.name, `${path}.name`, issues);
  const description = readString(o.description, `${path}.description`, issues);
  const unitPrice = readString(o.unitPrice, `${path}.unitPrice`, issues);
  // `quantity` is a STRING on this row (raw operator input), unlike the numeric quantity records.
  const quantity = readString(o.quantity, `${path}.quantity`, issues);
  const unitLabel = readString(o.unitLabel, `${path}.unitLabel`, issues);
  if (
    id === undefined || name === undefined || description === undefined ||
    unitPrice === undefined || quantity === undefined || unitLabel === undefined
  ) return undefined;
  return { id, name, description, unitPrice, quantity, unitLabel };
}

// ── Literal vocabularies ─────────────────────────────────────────────────────

const REGISTRATION_METHODS = ["new", "ocr", "search"] as const;
const SOURCE_MODES = ["existing", "new"] as const;
const PPF_METHODS: readonly PpfInstallationMethodId[] = ["full", "partial", "windshield", "sunroof", "interior"];
const PPF_FULL_COVERAGES = ["front_full", "full_body"] as const;
const DISCOUNT_MODES: readonly DiscountMode[] = ["none", "amount", "percent"];
const LAYER_COUNTS: readonly LayerCount[] = [1, 2, 3];

/** `LayerCount` is a NUMERIC literal union — `"2"` from a JSON round-trip must fail, never coerce. */
function readLayerCount(v: unknown, path: string, issues: Issues): LayerCount | null | undefined {
  if (v === null) return null;
  if (v === undefined) return add(issues, path, "missing-field");
  if (typeof v !== "number") return add(issues, path, "invalid-type");
  const hit = LAYER_COUNTS.find((n) => n === v);
  if (hit === undefined) return add(issues, path, "invalid-literal");
  return hit;
}

// ── Draft sections ───────────────────────────────────────────────────────────

function readSelectedCategories(v: unknown, path: string, issues: Issues): ServiceCategoryId[] | undefined {
  if (v === undefined) return add(issues, path, "missing-field");
  if (!Array.isArray(v)) return add(issues, path, "invalid-type");
  const p = `${path}[${ANY_KEY}]`;
  const out: ServiceCategoryId[] = [];
  const seen = new Set<string>();
  let ok = true;
  for (let i = 0; i < v.length; i += 1) {
    const raw: unknown = v[i];
    if (typeof raw !== "string") { add(issues, p, "invalid-type"); ok = false; continue; }
    // The canonical authority is reused, never re-spelled.
    if (!isServiceCategoryId(raw)) { add(issues, p, "invalid-literal"); ok = false; continue; }
    if (seen.has(raw)) { add(issues, p, "duplicate-value"); ok = false; continue; }
    seen.add(raw);
    out.push(raw);
  }
  return ok ? out : undefined;
}

type DraftSections = Omit<EstimateWizardDraftV22, "version">;

function readServiceConfiguration(
  v: unknown, path: string, issues: Issues,
): DraftSections["serviceConfiguration"] | undefined {
  const o = readObject(v, path, issues);
  if (o === undefined) return undefined;
  requireExactKeys(o, path, [
    "coating", "ppf", "windowFilm", "bodyMaintenance",
    "carWash", "roomCleaning", "otherWork", "storeGlobalOptions",
  ], issues);

  // ── coating ──
  const cRaw = readObject(o.coating, `${path}.coating`, issues);
  let coating: DraftSections["serviceConfiguration"]["coating"] | undefined;
  if (cRaw !== undefined) {
    requireExactKeys(cRaw, `${path}.coating`, ["layerCount", "layer1Id", "layer2Id", "layer3Id"], issues);
    const layerCount = readLayerCount(cRaw.layerCount, `${path}.coating.layerCount`, issues);
    const layer1Id = readNullableString(cRaw.layer1Id, `${path}.coating.layer1Id`, issues);
    const layer2Id = readNullableString(cRaw.layer2Id, `${path}.coating.layer2Id`, issues);
    const layer3Id = readNullableString(cRaw.layer3Id, `${path}.coating.layer3Id`, issues);
    if (layerCount !== undefined && layer1Id !== undefined && layer2Id !== undefined && layer3Id !== undefined) {
      coating = { layerCount, layer1Id, layer2Id, layer3Id };
    }
  }

  // ── ppf ──
  const pRaw = readObject(o.ppf, `${path}.ppf`, issues);
  let ppf: DraftSections["serviceConfiguration"]["ppf"] | undefined;
  if (pRaw !== undefined) {
    requireExactKeys(pRaw, `${path}.ppf`, [
      "installationMethod", "fullCoverage", "selectedPartIds", "quantitiesByPart", "ppfTypeId",
      "unitPriceInput", "vehicleCoefficientInput", "interiorRows",
    ], issues);
    const installationMethod = readNullableLiteral(pRaw.installationMethod, `${path}.ppf.installationMethod`, PPF_METHODS, issues);
    const fullCoverage = readNullableLiteral(pRaw.fullCoverage, `${path}.ppf.fullCoverage`, PPF_FULL_COVERAGES, issues);
    const selectedPartIds = readStringArray(pRaw.selectedPartIds, `${path}.ppf.selectedPartIds`, issues);
    const quantitiesByPart = readNumberRecord(pRaw.quantitiesByPart, `${path}.ppf.quantitiesByPart`, issues);
    const ppfTypeId = readNullableString(pRaw.ppfTypeId, `${path}.ppf.ppfTypeId`, issues);
    const unitPriceInput = readString(pRaw.unitPriceInput, `${path}.ppf.unitPriceInput`, issues);
    const vehicleCoefficientInput = readString(pRaw.vehicleCoefficientInput, `${path}.ppf.vehicleCoefficientInput`, issues);
    const interiorRows = readRowArray(pRaw.interiorRows, `${path}.ppf.interiorRows`, issues, readInteriorRow);
    if (
      installationMethod !== undefined && fullCoverage !== undefined && selectedPartIds !== undefined && quantitiesByPart !== undefined &&
      ppfTypeId !== undefined && unitPriceInput !== undefined && vehicleCoefficientInput !== undefined && interiorRows !== undefined
    ) {
      ppf = { installationMethod, fullCoverage, selectedPartIds, quantitiesByPart, ppfTypeId, unitPriceInput, vehicleCoefficientInput, interiorRows };
    }
  }

  // ── windowFilm ──
  const wRaw = readObject(o.windowFilm, `${path}.windowFilm`, issues);
  let windowFilm: DraftSections["serviceConfiguration"]["windowFilm"] | undefined;
  if (wRaw !== undefined) {
    requireExactKeys(wRaw, `${path}.windowFilm`, ["selectedAreaIds", "filmTypeId", "unitPriceInput"], issues);
    const selectedAreaIds = readStringArray(wRaw.selectedAreaIds, `${path}.windowFilm.selectedAreaIds`, issues);
    const filmTypeId = readNullableString(wRaw.filmTypeId, `${path}.windowFilm.filmTypeId`, issues);
    const unitPriceInput = readString(wRaw.unitPriceInput, `${path}.windowFilm.unitPriceInput`, issues);
    if (selectedAreaIds !== undefined && filmTypeId !== undefined && unitPriceInput !== undefined) {
      windowFilm = { selectedAreaIds, filmTypeId, unitPriceInput };
    }
  }

  // ── bodyMaintenance / carWash (identical shape) ──
  const readMenuAndPrice = (raw: unknown, p: string): { menuId: string | null; unitPriceInput: string } | undefined => {
    const mo = readObject(raw, p, issues);
    if (mo === undefined) return undefined;
    requireExactKeys(mo, p, ["menuId", "unitPriceInput"], issues);
    const menuId = readNullableString(mo.menuId, `${p}.menuId`, issues);
    const unitPriceInput = readString(mo.unitPriceInput, `${p}.unitPriceInput`, issues);
    if (menuId === undefined || unitPriceInput === undefined) return undefined;
    return { menuId, unitPriceInput };
  };
  const bodyMaintenance = readMenuAndPrice(o.bodyMaintenance, `${path}.bodyMaintenance`);
  const carWash = readMenuAndPrice(o.carWash, `${path}.carWash`);

  // ── roomCleaning ──
  const rRaw = readObject(o.roomCleaning, `${path}.roomCleaning`, issues);
  let roomCleaning: DraftSections["serviceConfiguration"]["roomCleaning"] | undefined;
  if (rRaw !== undefined) {
    requireExactKeys(rRaw, `${path}.roomCleaning`, ["selectedMenuIds", "unitPricesByMenu"], issues);
    const selectedMenuIds = readStringArray(rRaw.selectedMenuIds, `${path}.roomCleaning.selectedMenuIds`, issues);
    const unitPricesByMenu = readStringRecord(rRaw.unitPricesByMenu, `${path}.roomCleaning.unitPricesByMenu`, issues);
    if (selectedMenuIds !== undefined && unitPricesByMenu !== undefined) {
      roomCleaning = { selectedMenuIds, unitPricesByMenu };
    }
  }

  // ── otherWork ──
  const oRaw = readObject(o.otherWork, `${path}.otherWork`, issues);
  let otherWork: DraftSections["serviceConfiguration"]["otherWork"] | undefined;
  if (oRaw !== undefined) {
    requireExactKeys(oRaw, `${path}.otherWork`, [
      "selectedPresetIds", "unitPricesByItem", "quantitiesByItem", "customRows",
    ], issues);
    const selectedPresetIds = readStringArray(oRaw.selectedPresetIds, `${path}.otherWork.selectedPresetIds`, issues);
    const unitPricesByItem = readStringRecord(oRaw.unitPricesByItem, `${path}.otherWork.unitPricesByItem`, issues);
    const quantitiesByItem = readNumberRecord(oRaw.quantitiesByItem, `${path}.otherWork.quantitiesByItem`, issues);
    const customRows = readRowArray(oRaw.customRows, `${path}.otherWork.customRows`, issues, readCustomRow);
    if (
      selectedPresetIds !== undefined && unitPricesByItem !== undefined &&
      quantitiesByItem !== undefined && customRows !== undefined
    ) {
      otherWork = { selectedPresetIds, unitPricesByItem, quantitiesByItem, customRows };
    }
  }

  // ── storeGlobalOptions ──
  const sRaw = readObject(o.storeGlobalOptions, `${path}.storeGlobalOptions`, issues);
  let storeGlobalOptions: DraftSections["serviceConfiguration"]["storeGlobalOptions"] | undefined;
  if (sRaw !== undefined) {
    requireExactKeys(sRaw, `${path}.storeGlobalOptions`, [
      "selectedOptionIds", "unitPricesByOption", "quantitiesByOption",
    ], issues);
    const selectedOptionIds = readStringArray(sRaw.selectedOptionIds, `${path}.storeGlobalOptions.selectedOptionIds`, issues);
    const unitPricesByOption = readStringRecord(sRaw.unitPricesByOption, `${path}.storeGlobalOptions.unitPricesByOption`, issues);
    const quantitiesByOption = readNumberRecord(sRaw.quantitiesByOption, `${path}.storeGlobalOptions.quantitiesByOption`, issues);
    if (selectedOptionIds !== undefined && unitPricesByOption !== undefined && quantitiesByOption !== undefined) {
      storeGlobalOptions = { selectedOptionIds, unitPricesByOption, quantitiesByOption };
    }
  }

  if (
    coating === undefined || ppf === undefined || windowFilm === undefined ||
    bodyMaintenance === undefined || carWash === undefined || roomCleaning === undefined ||
    otherWork === undefined || storeGlobalOptions === undefined
  ) return undefined;

  return { coating, ppf, windowFilm, bodyMaintenance, carWash, roomCleaning, otherWork, storeGlobalOptions };
}

const DRAFT_ROOT_KEYS = [
  "version", "customer", "vehicle", "serviceSelection", "serviceConfiguration",
  "discountAndCoupon", "notes", "review", "metadata",
] as const;

function readDraft(v: unknown, path: string, issues: Issues): EstimateWizardDraftV22 | undefined {
  const o = readObject(v, path, issues);
  if (o === undefined) return undefined;
  requireExactKeys(o, path, DRAFT_ROOT_KEYS, issues);

  const version = readLiteral(o.version, `${path}.version`, ["2.2"], issues);

  // ── customer ──
  const cuRaw = readObject(o.customer, `${path}.customer`, issues);
  let customer: DraftSections["customer"] | undefined;
  if (cuRaw !== undefined) {
    requireExactKeys(cuRaw, `${path}.customer`, ["registrationMethod", "sourceMode", "customerId", "newCustomer"], issues);
    const registrationMethod = readLiteral(cuRaw.registrationMethod, `${path}.customer.registrationMethod`, REGISTRATION_METHODS, issues);
    const sourceMode = readNullableLiteral(cuRaw.sourceMode, `${path}.customer.sourceMode`, SOURCE_MODES, issues);
    const customerId = readNullableString(cuRaw.customerId, `${path}.customer.customerId`, issues);
    const newCustomer = readNewCustomer(cuRaw.newCustomer, `${path}.customer.newCustomer`, issues);
    if (registrationMethod !== undefined && sourceMode !== undefined && customerId !== undefined && newCustomer !== undefined) {
      customer = { registrationMethod, sourceMode, customerId, newCustomer };
    }
  }

  // ── vehicle ──
  const veRaw = readObject(o.vehicle, `${path}.vehicle`, issues);
  let vehicle: DraftSections["vehicle"] | undefined;
  if (veRaw !== undefined) {
    requireExactKeys(veRaw, `${path}.vehicle`, ["sourceMode", "vehicleId", "newVehicle", "bodySizeKey"], issues);
    const sourceMode = readNullableLiteral(veRaw.sourceMode, `${path}.vehicle.sourceMode`, SOURCE_MODES, issues);
    const vehicleId = readNullableString(veRaw.vehicleId, `${path}.vehicle.vehicleId`, issues);
    const newVehicle = readNewVehicle(veRaw.newVehicle, `${path}.vehicle.newVehicle`, issues);
    const bodySizeKey = readString(veRaw.bodySizeKey, `${path}.vehicle.bodySizeKey`, issues);
    if (sourceMode !== undefined && vehicleId !== undefined && newVehicle !== undefined && bodySizeKey !== undefined) {
      vehicle = { sourceMode, vehicleId, newVehicle, bodySizeKey };
    }
  }

  // ── serviceSelection ──
  const ssRaw = readObject(o.serviceSelection, `${path}.serviceSelection`, issues);
  let serviceSelection: DraftSections["serviceSelection"] | undefined;
  if (ssRaw !== undefined) {
    requireExactKeys(ssRaw, `${path}.serviceSelection`, ["selectedCategories"], issues);
    const selectedCategories = readSelectedCategories(ssRaw.selectedCategories, `${path}.serviceSelection.selectedCategories`, issues);
    if (selectedCategories !== undefined) serviceSelection = { selectedCategories };
  }

  const serviceConfiguration = readServiceConfiguration(o.serviceConfiguration, `${path}.serviceConfiguration`, issues);

  // ── discountAndCoupon ──
  const dcRaw = readObject(o.discountAndCoupon, `${path}.discountAndCoupon`, issues);
  let discountAndCoupon: DraftSections["discountAndCoupon"] | undefined;
  if (dcRaw !== undefined) {
    requireExactKeys(dcRaw, `${path}.discountAndCoupon`, [
      "mode", "percentInput", "amountInput", "selectedCouponIds", "adjustmentReason",
    ], issues);
    const mode = readLiteral(dcRaw.mode, `${path}.discountAndCoupon.mode`, DISCOUNT_MODES, issues);
    const percentInput = readString(dcRaw.percentInput, `${path}.discountAndCoupon.percentInput`, issues);
    const amountInput = readString(dcRaw.amountInput, `${path}.discountAndCoupon.amountInput`, issues);
    const selectedCouponIds = readStringArray(dcRaw.selectedCouponIds, `${path}.discountAndCoupon.selectedCouponIds`, issues);
    const adjustmentReason = readString(dcRaw.adjustmentReason, `${path}.discountAndCoupon.adjustmentReason`, issues);
    if (
      mode !== undefined && percentInput !== undefined && amountInput !== undefined &&
      selectedCouponIds !== undefined && adjustmentReason !== undefined
    ) {
      discountAndCoupon = { mode, percentInput, amountInput, selectedCouponIds, adjustmentReason };
    }
  }

  // ── notes ──
  const noRaw = readObject(o.notes, `${path}.notes`, issues);
  let notes: DraftSections["notes"] | undefined;
  if (noRaw !== undefined) {
    requireExactKeys(noRaw, `${path}.notes`, ["customerNotes", "internalMemo"], issues);
    const customerNotes = readString(noRaw.customerNotes, `${path}.notes.customerNotes`, issues);
    const internalMemo = readString(noRaw.internalMemo, `${path}.notes.internalMemo`, issues);
    if (customerNotes !== undefined && internalMemo !== undefined) notes = { customerNotes, internalMemo };
  }

  // ── review ──
  const reRaw = readObject(o.review, `${path}.review`, issues);
  let review: DraftSections["review"] | undefined;
  if (reRaw !== undefined) {
    requireExactKeys(reRaw, `${path}.review`, ["previewConfirmed"], issues);
    const previewConfirmed = readBoolean(reRaw.previewConfirmed, `${path}.review.previewConfirmed`, issues);
    if (previewConfirmed !== undefined) review = { previewConfirmed };
  }

  // ── metadata ──
  const meRaw = readObject(o.metadata, `${path}.metadata`, issues);
  let metadata: DraftSections["metadata"] | undefined;
  if (meRaw !== undefined) {
    requireExactKeys(meRaw, `${path}.metadata`, ["schemaVersion", "currentStep", "lastUpdatedAt", "source"], issues);
    const schemaVersion = readLiteral(meRaw.schemaVersion, `${path}.metadata.schemaVersion`, ["2.2"], issues);
    const currentStep = readCount(meRaw.currentStep, `${path}.metadata.currentStep`, issues);
    if (currentStep !== undefined && (currentStep < 1 || currentStep > 7)) {
      add(issues, `${path}.metadata.currentStep`, "invalid-number");
    }
    const lastUpdatedAt = readNullableString(meRaw.lastUpdatedAt, `${path}.metadata.lastUpdatedAt`, issues);
    const source = readLiteral(meRaw.source, `${path}.metadata.source`, ["estimate-wizard-v2.2"], issues);
    if (
      schemaVersion !== undefined && currentStep !== undefined && currentStep >= 1 && currentStep <= 7 &&
      lastUpdatedAt !== undefined && source !== undefined
    ) {
      metadata = { schemaVersion, currentStep, lastUpdatedAt, source };
    }
  }

  if (
    version === undefined || customer === undefined || vehicle === undefined ||
    serviceSelection === undefined || serviceConfiguration === undefined ||
    discountAndCoupon === undefined || notes === undefined || review === undefined || metadata === undefined
  ) return undefined;

  return {
    version, customer, vehicle, serviceSelection, serviceConfiguration,
    discountAndCoupon, notes, review, metadata,
  };
}

// ── Public validator ─────────────────────────────────────────────────────────

/**
 * Validate and RECONSTRUCT an untrusted save intent.
 *
 * Never throws. Never mutates `raw`. On success, the returned intent shares no mutable reference with
 * `raw`: every object, array and record along the way is rebuilt from individually-validated scalars.
 */
export function validateWizardSaveIntent(raw: unknown): WizardSaveIntentValidation {
  const issues: Issues = newIssues();
  try {
    const root = readObject(raw, "intent", issues);
    if (root === undefined) return { ok: false, issues: issues.list };
    requireExactKeys(root, "intent", WIZARD_SAVE_INTENT_ROOT_KEYS, issues);

    const draft = readDraft(root.draft, "intent.draft", issues);

    // expectedConfigRevision — finite, non-negative safe integer. No coercion.
    const revRaw: unknown = root.expectedConfigRevision;
    let expectedConfigRevision: number | undefined;
    if (revRaw === undefined) {
      add(issues, "intent.expectedConfigRevision", "missing-field");
    } else if (typeof revRaw !== "number" || !Number.isSafeInteger(revRaw) || revRaw < 0) {
      add(issues, "intent.expectedConfigRevision", "invalid-config-revision");
    } else {
      expectedConfigRevision = revRaw;
    }

    // idempotencyKey — required, never null, exact format.
    const keyRaw: unknown = root.idempotencyKey;
    let idempotencyKey: string | undefined;
    if (keyRaw === undefined) {
      add(issues, "intent.idempotencyKey", "missing-field");
    } else if (typeof keyRaw !== "string" || !IDEMPOTENCY_KEY_PATTERN.test(keyRaw)) {
      add(issues, "intent.idempotencyKey", "invalid-idempotency-key");
    } else {
      idempotencyKey = keyRaw;
    }

    if (issues.list.length > 0 || draft === undefined || expectedConfigRevision === undefined || idempotencyKey === undefined) {
      return { ok: false, issues: issues.list };
    }
    return { ok: true, intent: { draft, expectedConfigRevision, idempotencyKey } };
  } catch {
    // A THROWING getter / proxy trap only. Structural defects are all caught explicitly above.
    return { ok: false, issues: [{ path: "intent", code: "unreadable-input" }] };
  }
}
