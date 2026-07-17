// C2C4 — Estimate Wizard settings: PURE form validation/normalisation.
//
// Turns a raw client field record into the EXACT accepted C2C3 WizardCatalogItemInput,
// or field-specific Japanese errors. No DB, no auth, no lifecycle/permission decisions
// here — those belong to the server action + RPC. Writable fields are an explicit
// per-kind allowlist; any server-controlled field (dealer id, rank, lifecycle, review
// state, code, ownership, …) is rejected outright.

import {
  isSupportedAuthoringKind,
  type WizardCatalogItemInput,
  type SupportedAuthoringKind,
  type FilmPresentationInput,
} from "./wizard-catalog-authoring-types";

export type WizardItemFormErrors = Readonly<Record<string, string>>;

export type WizardItemFormResult =
  | { readonly ok: true; readonly input: WizardCatalogItemInput }
  | { readonly ok: false; readonly errors: WizardItemFormErrors };

const MSG = {
  kind: "対象の種別が正しくありません",
  labelJa: "表示名を入力してください",
  labelTooLong: "表示名が長すぎます（200文字以内）",
  priceYen: "価格は0以上の整数（税抜・円）で入力してください",
  durationMinutes: "所要時間は正の整数（分）で入力してください",
  displayOrder: "表示順は0以上の整数で入力してください",
  priceable: "価格対象の指定が正しくありません",
  quantityRequired: "数量指定の指定が正しくありません",
  minQuantity: "最小数量は1以上の整数で入力してください",
  maxQuantity: "最大数量は最小数量以上の整数で入力してください",
  presentation: "フィルム情報の値が正しくありません",
  itemId: "対象項目の指定が正しくありません",
  isActive: "表示状態の指定が正しくありません",
} as const;

// Writable fields per kind (camelCase, client-facing). Anything else is rejected.
const COMMON_FIELDS = ["kind", "itemId", "labelJa", "displayOrder", "isActive"] as const;
function allowedFields(kind: SupportedAuthoringKind): readonly string[] {
  switch (kind) {
    case "maintenance_menu":
    case "wash_menu":
    case "room_cleaning_menu":
      return [...COMMON_FIELDS, "priceYen", "durationMinutes"];
    case "film_type":
      return [...COMMON_FIELDS, "priceYen", "presentation"];
    case "other_work_preset":
      return [...COMMON_FIELDS];
    case "store_global_option":
      return [...COMMON_FIELDS, "priceYen", "priceable", "quantityRequired", "minQuantity", "maxQuantity"];
  }
}

const PRESENTATION_KEYS = ["brand", "vlt", "heatRejection", "color"] as const;

// Strict integer parse: accepts a JS integer or an integer-form string. Rejects
// fractional, NaN, Infinity, and non-numeric. Never silently coerces.
function parseIntStrict(v: unknown): { ok: true; value: number } | { ok: false } {
  if (typeof v === "number") {
    return Number.isInteger(v) ? { ok: true, value: v } : { ok: false };
  }
  if (typeof v === "string") {
    const t = v.trim();
    if (!/^-?\d+$/.test(t)) return { ok: false };
    const n = Number(t);
    return Number.isSafeInteger(n) ? { ok: true, value: n } : { ok: false };
  }
  return { ok: false };
}

function isBlankOptional(v: unknown): boolean {
  return v === undefined || v === null || (typeof v === "string" && v.trim() === "");
}

function parseBool(v: unknown): boolean | null {
  if (typeof v === "boolean") return v;
  if (v === "true") return true;
  if (v === "false") return false;
  return null;
}

function normStr(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

export function validateWizardItemForm(raw: Record<string, unknown>): WizardItemFormResult {
  const errors: Record<string, string> = {};

  // 1. kind must be a supported authoring kind (rejects coupon and any nonsense).
  const kind = raw.kind;
  if (!isSupportedAuthoringKind(kind)) {
    return { ok: false, errors: { kind: MSG.kind } };
  }

  // 2. explicit allowlist — reject any server-controlled / unknown field.
  const allowed = allowedFields(kind);
  for (const key of Object.keys(raw)) {
    if (!allowed.includes(key)) {
      errors._form = `許可されていない項目が含まれています：${key}`;
    }
  }

  // 3. itemId (optional; present ⇒ edit).
  let itemId: string | null | undefined;
  if (!isBlankOptional(raw.itemId)) {
    if (typeof raw.itemId !== "string") errors.itemId = MSG.itemId;
    else itemId = raw.itemId;
  } else {
    itemId = null;
  }

  // 4. label (required, trimmed, bounded).
  const labelJa = normStr(raw.labelJa);
  if (labelJa === "") errors.labelJa = MSG.labelJa;
  else if (labelJa.length > 200) errors.labelJa = MSG.labelTooLong;

  // 5. displayOrder (optional int >= 0; preserve 0).
  let displayOrder: number | undefined;
  if (!isBlankOptional(raw.displayOrder)) {
    const p = parseIntStrict(raw.displayOrder);
    if (!p.ok || p.value < 0) errors.displayOrder = MSG.displayOrder;
    else displayOrder = p.value;
  }

  // 6. isActive (optional bool).
  let isActive: boolean | undefined;
  if (raw.isActive !== undefined) {
    const b = parseBool(raw.isActive);
    if (b === null) errors.isActive = MSG.isActive;
    else isActive = b;
  }

  // 7. price (kinds that support it: menus/film/store — NOT other_work).
  const supportsPrice = kind !== "other_work_preset";
  let defaultUnitPrice: number | null | undefined;
  if (supportsPrice && !isBlankOptional(raw.priceYen)) {
    const p = parseIntStrict(raw.priceYen);
    if (!p.ok || p.value < 0) errors.priceYen = MSG.priceYen; // rejects negative/fractional/NaN/Infinity
    else defaultUnitPrice = p.value; // 0 preserved
  }

  // 8. duration (menus only, optional positive int).
  const isMenu = kind === "maintenance_menu" || kind === "wash_menu" || kind === "room_cleaning_menu";
  let durationMinutes: number | null | undefined;
  if (isMenu && !isBlankOptional(raw.durationMinutes)) {
    const p = parseIntStrict(raw.durationMinutes);
    if (!p.ok || p.value <= 0) errors.durationMinutes = MSG.durationMinutes;
    else durationMinutes = p.value;
  }

  // 9. store-option fields.
  let priceable: boolean | undefined;
  let quantityRequired: boolean | undefined;
  let minQuantity: number | undefined;
  let maxQuantity: number | null | undefined;
  if (kind === "store_global_option") {
    if (raw.priceable !== undefined) {
      const b = parseBool(raw.priceable);
      if (b === null) errors.priceable = MSG.priceable;
      else priceable = b;
    }
    if (raw.quantityRequired !== undefined) {
      const b = parseBool(raw.quantityRequired);
      if (b === null) errors.quantityRequired = MSG.quantityRequired;
      else quantityRequired = b;
    }
    if (!isBlankOptional(raw.minQuantity)) {
      const p = parseIntStrict(raw.minQuantity);
      if (!p.ok || p.value < 1) errors.minQuantity = MSG.minQuantity;
      else minQuantity = p.value;
    }
    if (!isBlankOptional(raw.maxQuantity)) {
      const p = parseIntStrict(raw.maxQuantity);
      if (!p.ok) errors.maxQuantity = MSG.maxQuantity;
      else maxQuantity = p.value;
    }
    const effMin = minQuantity ?? 1;
    if (maxQuantity !== undefined && maxQuantity !== null && maxQuantity < effMin) {
      errors.maxQuantity = MSG.maxQuantity;
    }
  }

  // 10. film presentation allowlist (strings only).
  let presentation: FilmPresentationInput | undefined;
  if (kind === "film_type" && raw.presentation !== undefined) {
    const pres = raw.presentation;
    if (pres === null || typeof pres !== "object") {
      errors.presentation = MSG.presentation;
    } else {
      const src = pres as Record<string, unknown>;
      const built: FilmPresentationInput = {};
      let bad = false;
      for (const key of Object.keys(src)) {
        if (!(PRESENTATION_KEYS as readonly string[]).includes(key)) { bad = true; continue; }
        const val = src[key];
        if (val === undefined || (typeof val === "string" && val.trim() === "")) continue;
        if (typeof val !== "string") { bad = true; continue; }
        (built as Record<string, string>)[key] = val.trim();
      }
      if (bad) errors.presentation = MSG.presentation;
      else if (Object.keys(built).length > 0) presentation = built;
    }
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  // Build the EXACT accepted C2C3 payload shape (only fields relevant to the kind).
  const input: WizardCatalogItemInput = {
    itemId,
    kind,
    labelJa,
    ...(displayOrder !== undefined ? { displayOrder } : {}),
    ...(isActive !== undefined ? { isActive } : {}),
    ...(defaultUnitPrice !== undefined ? { defaultUnitPrice } : {}),
    ...(durationMinutes !== undefined ? { durationMinutes } : {}),
    ...(priceable !== undefined ? { priceable } : {}),
    ...(quantityRequired !== undefined ? { quantityRequired } : {}),
    ...(minQuantity !== undefined ? { minQuantity } : {}),
    ...(maxQuantity !== undefined ? { maxQuantity } : {}),
    ...(presentation !== undefined ? { presentation } : {}),
  };
  return { ok: true, input };
}
