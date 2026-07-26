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
  installCoefficientBp: "施工係数は正の整数（basis points, 10000 = ×1.00）で入力してください",
  couponDiscountType: "クーポンの割引種別が正しくありません",
  couponDiscountValue: "クーポンの割引値は0以上の整数で入力してください",
  couponCombinable: "クーポンの併用可否の指定が正しくありません",
  couponValidFrom: "有効期間（開始）はYYYY-MM-DD形式で入力してください",
  couponValidTo: "有効期間（終了）はYYYY-MM-DD形式で入力してください",
} as const;

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Writable fields per kind (camelCase, client-facing). Anything else is rejected.
//
// EXHAUSTIVE BY CONSTRUCTION. The `never` default is not decoration: this function previously
// omitted the two kinds B1.1 added, fell through to `undefined`, and the caller's
// `allowed.includes(key)` threw a TypeError for every coupon and PPF-type submission. The
// assertion below makes that failure a COMPILE error the next time a kind is added.
const COMMON_FIELDS = ["kind", "itemId", "labelJa", "displayOrder", "isActive"] as const;
function allowedFields(kind: SupportedAuthoringKind): readonly string[] {
  switch (kind) {
    case "maintenance_menu":
    case "wash_menu":
    case "room_cleaning_menu":
      return [...COMMON_FIELDS, "priceYen", "durationMinutes"];
    case "film_type":
      return [...COMMON_FIELDS, "priceYen", "presentation", "installCoefficientBp"];
    case "ppf_type_group":
      return [...COMMON_FIELDS, "priceYen", "installCoefficientBp"];
    case "coupon":
      // No priceYen: a coupon's monetary meaning is its discount value, and the RPC refuses
      // default_unit_price on a coupon (WIZ_COUPON_PRICE_FORBIDDEN).
      return [
        ...COMMON_FIELDS,
        "couponDiscountType", "couponDiscountValue", "couponCombinable",
        "couponValidFrom", "couponValidTo",
      ];
    case "other_work_preset":
      return [...COMMON_FIELDS];
    case "store_global_option":
      return [...COMMON_FIELDS, "priceYen", "priceable", "quantityRequired", "minQuantity", "maxQuantity"];
    default: {
      const exhaustive: never = kind;
      throw new Error(`unhandled authoring kind: ${String(exhaustive)}`);
    }
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

  // 1. kind must be a supported authoring kind (B1.1: coupon and ppf_type_group are now among
  //    them; ppf_method / ppf_part / window_area remain global read-only and are still rejected).
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

  // 7. price (kinds that support it: menus/film/ppf/store — NOT other_work, NOT coupon).
  const supportsPrice = kind !== "other_work_preset" && kind !== "coupon";
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

  // 11. PPF installation coefficient (film/ppf only, optional, positive integer BASIS POINTS).
  //     Allowlisting a field without parsing it would drop it silently, so the two kinds that
  //     accept it above must also read it here.
  let installCoefficientBp: number | undefined;
  if ((kind === "film_type" || kind === "ppf_type_group") && !isBlankOptional(raw.installCoefficientBp)) {
    const p = parseIntStrict(raw.installCoefficientBp);
    if (!p.ok || p.value <= 0) errors.installCoefficientBp = MSG.installCoefficientBp;
    else installCoefficientBp = p.value;
  }

  // 12. Coupon rule. Bounds (percent 0–100, validity ordering) are enforced by the authoring core
  //     and the database CHECKs — this pass only rejects malformed SHAPES, exactly as elsewhere.
  //     `couponDiscountValue` is stored in the unit it is authored in: yen for `amount`, an
  //     INTEGER PERCENT 0–100 for `percent`. No conversion happens here.
  let couponDiscountType: "amount" | "percent" | undefined;
  let couponDiscountValue: number | undefined;
  let couponCombinable: boolean | undefined;
  let couponValidFrom: string | null | undefined;
  let couponValidTo: string | null | undefined;
  if (kind === "coupon") {
    const t = raw.couponDiscountType;
    if (t === "amount" || t === "percent") couponDiscountType = t;
    else errors.couponDiscountType = MSG.couponDiscountType;

    const p = parseIntStrict(raw.couponDiscountValue);
    if (!p.ok || p.value < 0) errors.couponDiscountValue = MSG.couponDiscountValue;
    else couponDiscountValue = p.value;

    const b = parseBool(raw.couponCombinable);
    if (b === null) errors.couponCombinable = MSG.couponCombinable;
    else couponCombinable = b;

    // Blank/absent means open-ended and persists as an explicit null.
    if (isBlankOptional(raw.couponValidFrom)) couponValidFrom = null;
    else if (typeof raw.couponValidFrom === "string" && ISO_DATE_RE.test(raw.couponValidFrom.trim())) {
      couponValidFrom = raw.couponValidFrom.trim();
    } else errors.couponValidFrom = MSG.couponValidFrom;

    if (isBlankOptional(raw.couponValidTo)) couponValidTo = null;
    else if (typeof raw.couponValidTo === "string" && ISO_DATE_RE.test(raw.couponValidTo.trim())) {
      couponValidTo = raw.couponValidTo.trim();
    } else errors.couponValidTo = MSG.couponValidTo;
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
    ...(installCoefficientBp !== undefined ? { installCoefficientBp } : {}),
    ...(couponDiscountType !== undefined ? { couponDiscountType } : {}),
    ...(couponDiscountValue !== undefined ? { couponDiscountValue } : {}),
    ...(couponCombinable !== undefined ? { couponCombinable } : {}),
    ...(couponValidFrom !== undefined ? { couponValidFrom } : {}),
    ...(couponValidTo !== undefined ? { couponValidTo } : {}),
  };
  return { ok: true, input };
}
