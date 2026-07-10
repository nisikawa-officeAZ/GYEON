// Estimate Wizard Ver2.2 — Manual pricing line builder (Phase 10F-R).
//
// Pure, deterministic, side-effect free. Builds `WizardManualPricingLineInput[]` from the canonical
// draft for the approved MANUAL-price categories (PPF / Window / Body Maintenance / Car Wash / Room
// Cleaning / Other Work / Store Global Options). It NEVER performs tax/discount/coupon math and NEVER
// aggregates a total — it only prepares per-line operator amounts for the canonical pricing domain.
//
// STRICT rules (Architect resolution §5/§8/§9/§11):
//   • Identity always comes from a STABLE existing config/draft id — never a label, never an index.
//   • The priced amount is the OPERATOR-entered value only. The EXAMPLE config `defaultPrice` is a
//     PREVIEW fixture and is NEVER used in a total (config supplies labels + quantity RULES only).
//   • Missing required amount → MANUAL_PRICE_REQUIRED. Invalid value → INVALID_MANUAL_PRICE. Invalid
//     quantity → INVALID_QUANTITY. Amount without a selected identity → MANUAL_PRICING_IDENTITY_MISSING.
//   • Nothing is inferred, zero-substituted, or silently dropped; every unresolved item is reported.

import { DEFAULT_PPF_METHODS } from "../screens/ppf-config";
import { EXAMPLE_FILM_TYPES } from "../screens/window-film-config";
import { EXAMPLE_MAINTENANCE_MENUS } from "../screens/body-maintenance-config";
import { EXAMPLE_WASH_MENUS } from "../screens/car-wash-config";
import { EXAMPLE_ROOM_MENUS } from "../screens/room-cleaning-config";
import { EXAMPLE_STORE_GLOBAL_OPTIONS } from "../screens/store-global-options-config";
import type { EstimateWizardDraftV22 } from "../draft/wizard-draft-types";
import type { WizardManualPricingLineInput } from "./wizard-pricing-identity";
import type { WizardPricingIssue } from "./wizard-pricing-types";
import { WIZARD_PRICING_ERRORS, WIZARD_PRICING_WARNINGS } from "./wizard-pricing-types";

export interface ManualPricingBundle {
  lines:    WizardManualPricingLineInput[];
  warnings: WizardPricingIssue[];
  errors:   WizardPricingIssue[];
}

function issue(code: string, message: string, category: string | null, sourceId: string | null): WizardPricingIssue {
  return { code, category, sourceId, message };
}

/** Parse an operator-entered amount string. Empty and invalid are distinct (different error codes). */
function parseAmount(raw: string | undefined): { ok: boolean; empty: boolean; value: number } {
  const t = (raw ?? "").trim();
  if (t === "") return { ok: false, empty: true, value: 0 };
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0) return { ok: false, empty: false, value: 0 };
  return { ok: true, empty: false, value: n };
}

export function buildManualPricingLines(draft: EstimateWizardDraftV22): ManualPricingBundle {
  const lines: WizardManualPricingLineInput[] = [];
  const warnings: WizardPricingIssue[] = [];
  const errors: WizardPricingIssue[] = [];
  const cfg = draft.serviceConfiguration;
  const selected = draft.serviceSelection.selectedCategories;

  const requireAmount = (category: string, sourceId: string | null, msg: string) =>
    errors.push(issue(WIZARD_PRICING_ERRORS.MANUAL_PRICE_REQUIRED, msg, category, sourceId));
  const invalidAmount = (category: string, sourceId: string | null, msg: string) =>
    errors.push(issue(WIZARD_PRICING_ERRORS.INVALID_MANUAL_PRICE, msg, category, sourceId));

  // ── PPF (manual_only) — single amount per method; method "interior" prices via free rows. ──
  if (selected.includes("ppf")) {
    const p = cfg.ppf;
    const method = p.installationMethod;
    if (!method) {
      requireAmount("ppf", null, "PPFの施工方法と金額を入力してください。");
    } else if (method === "interior") {
      const rows = p.interiorRows.filter((r) => r.location.trim() !== "" || r.amount.trim() !== "");
      if (rows.length === 0) requireAmount("ppf", "interior", "内装PPFの施工箇所と金額を入力してください。");
      for (const row of rows) {
        const amt = parseAmount(row.amount);
        if (amt.ok) {
          lines.push({
            sourceCategory: "ppf", manualPricingIdentity: row.id, label: row.location.trim() || "内装PPF",
            quantity: 1, unitPrice: amt.value, optionIdentity: null, metadata: { method: "interior" },
          });
        } else if (amt.empty) requireAmount("ppf", row.id, `内装PPF「${row.location.trim() || "行"}」の金額が未入力です。`);
        else invalidAmount("ppf", row.id, `内装PPF「${row.location.trim() || "行"}」の金額が不正です。`);
      }
    } else {
      const methodLabel = DEFAULT_PPF_METHODS.find((m) => m.id === method)?.label ?? method;
      const amt = parseAmount(p.unitPriceInput);
      if (amt.ok) {
        lines.push({
          sourceCategory: "ppf", manualPricingIdentity: method, label: `PPF ${methodLabel}`,
          quantity: 1, unitPrice: amt.value, optionIdentity: p.ppfTypeId,
          metadata: { method, ppfType: p.ppfTypeId, parts: p.selectedPartIds.join(",") },
        });
      } else if (amt.empty) requireAmount("ppf", method, `PPF（${methodLabel}）の金額が未入力です。`);
      else invalidAmount("ppf", method, `PPF（${methodLabel}）の金額が不正です。`);
    }
  }

  // ── Window Film (manual_only) — single amount; identity = selected film-type config id. ──
  if (selected.includes("window")) {
    const w = cfg.windowFilm;
    const amt = parseAmount(w.unitPriceInput);
    if (!w.filmTypeId) {
      if (!amt.empty) errors.push(issue(WIZARD_PRICING_ERRORS.MANUAL_PRICING_IDENTITY_MISSING, "フィルム種別が未選択のため金額を計算に含められません。", "window", null));
      else requireAmount("window", null, "ウィンドウフィルムの種別と金額を入力してください。");
    } else {
      const filmLabel = EXAMPLE_FILM_TYPES.find((f) => f.id === w.filmTypeId)?.label ?? w.filmTypeId;
      if (amt.ok) {
        lines.push({
          sourceCategory: "window", manualPricingIdentity: w.filmTypeId, label: `ウィンドウフィルム（${filmLabel}）`,
          quantity: 1, unitPrice: amt.value, optionIdentity: null, metadata: { areas: w.selectedAreaIds.join(",") },
        });
      } else if (amt.empty) requireAmount("window", w.filmTypeId, `ウィンドウフィルム（${filmLabel}）の金額が未入力です。`);
      else invalidAmount("window", w.filmTypeId, `ウィンドウフィルム（${filmLabel}）の金額が不正です。`);
    }
  }

  // ── Body Maintenance (manual_only) — single menu + single amount. ──
  if (selected.includes("maintenance")) {
    const bm = cfg.bodyMaintenance;
    if (!bm.menuId) {
      requireAmount("maintenance", null, "ボディメンテナンスのメニューと金額を選択してください。");
    } else {
      const label = EXAMPLE_MAINTENANCE_MENUS.find((m) => m.id === bm.menuId)?.name ?? bm.menuId;
      const amt = parseAmount(bm.unitPriceInput);
      if (amt.ok) lines.push({ sourceCategory: "maintenance", manualPricingIdentity: bm.menuId, label, quantity: 1, unitPrice: amt.value, optionIdentity: null, metadata: {} });
      else if (amt.empty) requireAmount("maintenance", bm.menuId, `「${label}」の金額が未入力です。`);
      else invalidAmount("maintenance", bm.menuId, `「${label}」の金額が不正です。`);
    }
  }

  // ── Car Wash (manual_only) — separate from Body Maintenance; single menu + single amount. ──
  if (selected.includes("carwash")) {
    const cw = cfg.carWash;
    if (!cw.menuId) {
      requireAmount("carwash", null, "洗車メニューと金額を選択してください。");
    } else {
      const label = EXAMPLE_WASH_MENUS.find((m) => m.id === cw.menuId)?.name ?? cw.menuId;
      const amt = parseAmount(cw.unitPriceInput);
      if (amt.ok) lines.push({ sourceCategory: "carwash", manualPricingIdentity: cw.menuId, label, quantity: 1, unitPrice: amt.value, optionIdentity: null, metadata: {} });
      else if (amt.empty) requireAmount("carwash", cw.menuId, `「${label}」の金額が未入力です。`);
      else invalidAmount("carwash", cw.menuId, `「${label}」の金額が不正です。`);
    }
  }

  // ── Room Cleaning (manual_only) — MULTIPLE menus, one amount per selected menu. ──
  if (selected.includes("roomclean")) {
    const rc = cfg.roomCleaning;
    if (rc.selectedMenuIds.length === 0) {
      requireAmount("roomclean", null, "ルームクリーニングのメニューを選択してください。");
    }
    for (const id of rc.selectedMenuIds) {
      const label = EXAMPLE_ROOM_MENUS.find((m) => m.id === id)?.name ?? id;
      const amt = parseAmount(rc.unitPricesByMenu[id]);
      if (amt.ok) lines.push({ sourceCategory: "roomclean", manualPricingIdentity: id, label, quantity: 1, unitPrice: amt.value, optionIdentity: null, metadata: {} });
      else if (amt.empty) requireAmount("roomclean", id, `「${label}」の金額が未入力です。`);
      else invalidAmount("roomclean", id, `「${label}」の金額が不正です。`);
    }
  }

  // ── Other Work (manual_only) — custom rows priced; presets stay preview-only (existing path). ──
  if (selected.includes("other")) {
    const ow = cfg.otherWork;
    if (ow.selectedPresetIds.length > 0) {
      warnings.push(issue(WIZARD_PRICING_WARNINGS.PREVIEW_ONLY_ITEM, "プリセット項目はプレビュー表示のみで、合計には含まれません（手入力行のみ計算対象）。", "other", null));
    }
    for (const row of ow.customRows) {
      const name = row.name.trim();
      if (!name) continue; // an unnamed row is not yet a service line
      const amt = parseAmount(row.unitPrice);
      if (!amt.ok) {
        if (amt.empty) requireAmount("other", row.id, `「${name}」の金額が未入力です。`);
        else invalidAmount("other", row.id, `「${name}」の金額が不正です。`);
        continue;
      }
      // Quantity limitation is preserved explicitly: the custom-row quantity is a free operator note
      // (raw string) and the production manual path does not multiply by it (Phase 10D behavior).
      const qtyNote = row.quantity.trim();
      if (qtyNote !== "" && qtyNote !== "1") {
        warnings.push(issue(WIZARD_PRICING_WARNINGS.PREVIEW_ONLY_ITEM, `「${name}」の数量（${qtyNote}）は現状の計算に反映されません（単価のみ計算）。`, "other", row.id));
      }
      lines.push({ sourceCategory: "other", manualPricingIdentity: row.id, label: name, quantity: 1, unitPrice: amt.value, optionIdentity: null, metadata: { quantityInput: qtyNote } });
    }
  }

  // ── Store Global Options (per-option manual_only / not_priceable) — cross-category selection. ──
  for (const id of cfg.storeGlobalOptions.selectedOptionIds) {
    const opt = EXAMPLE_STORE_GLOBAL_OPTIONS.find((o) => o.id === id);
    const label = opt?.name ?? id;
    // Classification from the config field (NOT the label): an option the operator cannot price is
    // not_priceable and never enters totals.
    if (opt && opt.editableUnitPrice === false) {
      warnings.push(issue(WIZARD_PRICING_WARNINGS.PREVIEW_ONLY_ITEM, `「${label}」は価格対象外のオプションのため合計に含まれません。`, "store_global_options", id));
      continue;
    }
    const amt = parseAmount(cfg.storeGlobalOptions.unitPricesByOption[id]);
    // Quantity multiplication authorized only where the config declares quantityRequired (§10).
    let quantity = 1;
    if (opt?.quantityRequired) {
      const minQty = opt.minQty ?? 1;
      const maxQty = opt.maxQty;
      // An unset quantity defaults to the configured minimum (not yet entered ≠ invalid); an explicit
      // out-of-range value is a controlled INVALID_QUANTITY.
      const raw = cfg.storeGlobalOptions.quantitiesByOption[id];
      const q = raw == null ? minQty : raw;
      if (!Number.isInteger(q) || q < minQty || (maxQty != null && q > maxQty)) {
        errors.push(issue(WIZARD_PRICING_ERRORS.INVALID_QUANTITY, `「${label}」の数量が不正です。`, "store_global_options", id));
        continue;
      }
      quantity = q;
    }
    if (amt.ok) {
      lines.push({ sourceCategory: "store_global_options", manualPricingIdentity: id, label, quantity, unitPrice: amt.value, optionIdentity: null, metadata: { quantityRequired: !!opt?.quantityRequired } });
    } else if (amt.empty) requireAmount("store_global_options", id, `「${label}」の金額が未入力です。`);
    else invalidAmount("store_global_options", id, `「${label}」の金額が不正です。`);
  }

  return { lines, warnings, errors };
}
