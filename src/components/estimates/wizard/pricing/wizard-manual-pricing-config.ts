// Estimate Wizard Ver2.2 — CONFIG-DRIVEN manual pricing line builder (Phase 8-B2F-B).
//
// PURE. No React, no server module, no DB, no API, no clock, no randomness, no `any`, no cast.
// **NO FIXTURE IMPORT.** This module imports no `EXAMPLE_*` and no `DEFAULT_*` screen config, by
// design and by test.
//
// ── WHY THIS EXISTS ─────────────────────────────────────────────────────────────
// `wizard-manual-pricing.ts` hard-imports the fixture modules at module scope and resolves every
// manual line's `label` from them, with a `?? id` fallback. That `label` becomes
// `estimate_items.item_name` (via `{type:"other"}` → `buildLineItems` → the editor → `create-estimate`).
// So today an invented preview name — 「6か月メンテナンス」, 「PPF フル施工」 — or, when a dealer id has
// no fixture match, a RAW ID, would be written permanently onto a customer-facing estimate.
//
// This module is the production replacement. Labels come ONLY from a required, caller-supplied
// configuration. There is no default configuration, no fixture fallback, and no `label ?? id`.
// An unknown, disabled, or absent code produces a BLOCKING error and NO line — so a raw code can
// never become an item name.
//
// ── WHAT IS DELIBERATELY UNCHANGED ──────────────────────────────────────────────
// Every price rule is copied verbatim from `wizard-manual-pricing.ts`:
//   • The priced amount is the OPERATOR-entered value ONLY. Configuration supplies labels and
//     quantity RULES — never a price. There is therefore no second price source, and the existing
//     precedence is untouched.
//   • Tax, rounding, discounts, totals, coupons and rank coefficients are not computed here and are
//     not moved. `PricingCatalog` remains authoritative exactly where it is authoritative today.
//   • Amount parsing, the empty/invalid distinction, and the quantity rules are identical, so
//     equivalent inputs produce identical prices. The test suite proves this against the fixture path
//     line-for-line.
//
// Behavioural differences from the fixture path, all deliberate:
//   1. Labels come only from the required configuration; there is no `?? id` fallback.
//   2. A selected NOT-PRICEABLE option BLOCKS instead of being dropped with a warning
//      (Phase 8-B2F-BH). A selected option is billed, or the apply stops. Never silently discarded.

import type { EstimateWizardDraftV22 } from "../draft/wizard-draft-types";
import type { WizardManualPricingLineInput } from "./wizard-pricing-identity";
import type { WizardPricingIssue } from "./wizard-pricing-types";
import { WIZARD_PRICING_ERRORS, WIZARD_PRICING_WARNINGS } from "./wizard-pricing-types";

/**
 * A blocking issue: a selected code has no authoritative configuration entry.
 *
 * Declared locally because `wizard-pricing-types.ts` is outside this phase's allowlist and
 * `WizardPricingIssue.code` is a plain `string`. It behaves exactly like the other error codes:
 * `buildEstimateEditorApplyPlan` maps a non-empty `errors` array to `blocked / "pricing-invalid"`
 * with no patch and no items.
 */
export const WIZARD_PRICING_CONFIG_ERRORS = {
  /** The operator selected an item that the resolved configuration does not offer. */
  UNKNOWN_CONFIGURED_ITEM: "UNKNOWN_CONFIGURED_ITEM",
  /**
   * The operator selected an option the configuration marks NOT PRICEABLE.
   *
   * BLOCKING, by Architect ruling (Phase 8-B2F-BH): a selected production option must either produce
   * a priced line or block the plan. It must never be silently discarded.
   *
   * Previously this was a `PREVIEW_ONLY_ITEM` warning — the line was dropped and the plan stayed
   * `ready`. The container reads only `blockedMessage`, so the warning never reached the operator:
   * a genuinely billable service mis-marked `priceable: false` (a plausible seeding or dealer-override
   * mistake) would vanish from the estimate and the total with no signal at all. Now it stops the
   * apply outright.
   */
  NON_PRICEABLE_SELECTED_ITEM: "NON_PRICEABLE_SELECTED_ITEM",
} as const;

// ── The required production configuration contract ───────────────────────────────
/**
 * An authoritative, operator-selectable item: a stable `code` and a resolved `label`. Nothing else.
 *
 * Deliberately independent of any future DB schema — whatever supplies it (the wizard catalog,
 * dealer settings, a static module) maps INTO this shape. Nothing here presumes a column.
 *
 * There is NO price field, and no quantity field. Price ownership does not move: the operator enters
 * the amount, exactly as the existing manual path requires, and every one of these categories prices
 * a single unit (`quantity: 1`).
 */
export interface ProductionLabelOption {
  /** Stable identity. The value stored in the draft and matched against. Never a label. */
  readonly code: string;
  /** Authoritative, already-resolved display label. This is what becomes `item_name`. */
  readonly label: string;
}

/**
 * A store-global option — the ONLY category with priceability and quantity rules.
 *
 * These four fields exist here and nowhere else (Phase 8-B2F-BH). Previously every collection
 * carried them, so a caller could set `quantityRequired: true` on a maintenance menu and have it
 * silently ignored — a field that looks load-bearing and is not. TypeScript now rejects that
 * outright: the other five collections take `ProductionLabelOption`, which has no such fields.
 */
export interface ProductionStoreGlobalOption extends ProductionLabelOption {
  /**
   * `false` ⇒ the operator cannot price it. Selecting it now BLOCKS the plan rather than dropping
   * the line — see `NON_PRICEABLE_SELECTED_ITEM`.
   */
  readonly priceable: boolean;
  /** When true, quantity is multiplied into the line. Mirrors the existing `quantityRequired` rule. */
  readonly quantityRequired: boolean;
  readonly minQuantity: number;
  readonly maxQuantity: number | null;
}

/**
 * Every manual category's authoritative option set. REQUIRED — there is no default, and a caller
 * that cannot supply one cannot price a draft.
 *
 * Not listed: `otherWork.customRows`, which are operator-authored free text. Their label is what the
 * operator literally typed, so no configuration can or should override it.
 */
export interface ProductionPricingConfiguration {
  readonly ppfMethods:         readonly ProductionLabelOption[];
  readonly filmTypes:          readonly ProductionLabelOption[];
  readonly maintenanceMenus:   readonly ProductionLabelOption[];
  readonly washMenus:          readonly ProductionLabelOption[];
  readonly roomCleaningMenus:  readonly ProductionLabelOption[];
  readonly storeGlobalOptions: readonly ProductionStoreGlobalOption[];
}

export interface ConfigManualPricingBundle {
  readonly lines:    WizardManualPricingLineInput[];
  readonly warnings: WizardPricingIssue[];
  readonly errors:   WizardPricingIssue[];
}

// ── Internals ────────────────────────────────────────────────────────────────────
function issue(code: string, message: string, category: string | null, sourceId: string | null): WizardPricingIssue {
  return { code, category, sourceId, message };
}

/** Identical to the fixture path's parser — empty and invalid stay distinct. */
function parseAmount(raw: string | undefined): { ok: boolean; empty: boolean; value: number } {
  const t = (raw ?? "").trim();
  if (t === "") return { ok: false, empty: true, value: 0 };
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0) return { ok: false, empty: false, value: 0 };
  return { ok: true, empty: false, value: n };
}

/**
 * Resolve a selected code against the authoritative configuration.
 *
 * Returns `null` when the code is unknown. There is NO `?? code` fallback anywhere in this module —
 * that fallback is exactly how a raw id became a persisted `item_name`.
 */
function lookup<T extends ProductionLabelOption>(
  options: readonly T[],
  code: string,
): T | null {
  return options.find((o) => o.code === code) ?? null;
}

export function buildManualPricingLinesFromConfig(
  draft: EstimateWizardDraftV22,
  config: ProductionPricingConfiguration,
): ConfigManualPricingBundle {
  const lines: WizardManualPricingLineInput[] = [];
  const warnings: WizardPricingIssue[] = [];
  const errors: WizardPricingIssue[] = [];
  const cfg = draft.serviceConfiguration;
  const selected = draft.serviceSelection.selectedCategories;

  const requireAmount = (category: string, sourceId: string | null, msg: string) =>
    errors.push(issue(WIZARD_PRICING_ERRORS.MANUAL_PRICE_REQUIRED, msg, category, sourceId));
  const invalidAmount = (category: string, sourceId: string | null, msg: string) =>
    errors.push(issue(WIZARD_PRICING_ERRORS.INVALID_MANUAL_PRICE, msg, category, sourceId));
  /** A selected code with no authoritative entry. BLOCKING, and no line is produced. */
  const unknownItem = (category: string, sourceId: string) =>
    errors.push(issue(
      WIZARD_PRICING_CONFIG_ERRORS.UNKNOWN_CONFIGURED_ITEM,
      "選択された項目が店舗の設定に見つかりません。選択し直してください。",
      category,
      sourceId,
    ));

  // ── PPF ───────────────────────────────────────────────────────────────────────
  if (selected.includes("ppf")) {
    const p = cfg.ppf;
    const method = p.installationMethod;
    if (!method) {
      requireAmount("ppf", null, "PPFの施工方法と金額を入力してください。");
    } else if (method === "interior") {
      // Operator-authored free rows: the label is what they typed. No configuration governs it.
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
      const opt = lookup(config.ppfMethods, method);
      if (!opt) {
        unknownItem("ppf", method); // no line — a raw method id can never become an item name
      } else {
        const amt = parseAmount(p.unitPriceInput);
        if (amt.ok) {
          lines.push({
            sourceCategory: "ppf", manualPricingIdentity: method, label: `PPF ${opt.label}`,
            quantity: 1, unitPrice: amt.value, optionIdentity: p.ppfTypeId,
            metadata: { method, ppfType: p.ppfTypeId, parts: p.selectedPartIds.join(",") },
          });
        } else if (amt.empty) requireAmount("ppf", method, `PPF（${opt.label}）の金額が未入力です。`);
        else invalidAmount("ppf", method, `PPF（${opt.label}）の金額が不正です。`);
      }
    }
  }

  // ── Window Film ───────────────────────────────────────────────────────────────
  if (selected.includes("window")) {
    const w = cfg.windowFilm;
    const amt = parseAmount(w.unitPriceInput);
    if (!w.filmTypeId) {
      if (!amt.empty) errors.push(issue(WIZARD_PRICING_ERRORS.MANUAL_PRICING_IDENTITY_MISSING, "フィルム種別が未選択のため金額を計算に含められません。", "window", null));
      else requireAmount("window", null, "ウィンドウフィルムの種別と金額を入力してください。");
    } else {
      const opt = lookup(config.filmTypes, w.filmTypeId);
      if (!opt) {
        unknownItem("window", w.filmTypeId);
      } else if (amt.ok) {
        lines.push({
          sourceCategory: "window", manualPricingIdentity: w.filmTypeId, label: `ウィンドウフィルム（${opt.label}）`,
          quantity: 1, unitPrice: amt.value, optionIdentity: null, metadata: { areas: w.selectedAreaIds.join(",") },
        });
      } else if (amt.empty) requireAmount("window", w.filmTypeId, `ウィンドウフィルム（${opt.label}）の金額が未入力です。`);
      else invalidAmount("window", w.filmTypeId, `ウィンドウフィルム（${opt.label}）の金額が不正です。`);
    }
  }

  // ── Body Maintenance ──────────────────────────────────────────────────────────
  if (selected.includes("maintenance")) {
    const bm = cfg.bodyMaintenance;
    if (!bm.menuId) {
      requireAmount("maintenance", null, "ボディメンテナンスのメニューと金額を選択してください。");
    } else {
      const opt = lookup(config.maintenanceMenus, bm.menuId);
      if (!opt) {
        unknownItem("maintenance", bm.menuId);
      } else {
        const amt = parseAmount(bm.unitPriceInput);
        if (amt.ok) lines.push({ sourceCategory: "maintenance", manualPricingIdentity: bm.menuId, label: opt.label, quantity: 1, unitPrice: amt.value, optionIdentity: null, metadata: {} });
        else if (amt.empty) requireAmount("maintenance", bm.menuId, `「${opt.label}」の金額が未入力です。`);
        else invalidAmount("maintenance", bm.menuId, `「${opt.label}」の金額が不正です。`);
      }
    }
  }

  // ── Car Wash ──────────────────────────────────────────────────────────────────
  if (selected.includes("carwash")) {
    const cw = cfg.carWash;
    if (!cw.menuId) {
      requireAmount("carwash", null, "洗車メニューと金額を選択してください。");
    } else {
      const opt = lookup(config.washMenus, cw.menuId);
      if (!opt) {
        unknownItem("carwash", cw.menuId);
      } else {
        const amt = parseAmount(cw.unitPriceInput);
        if (amt.ok) lines.push({ sourceCategory: "carwash", manualPricingIdentity: cw.menuId, label: opt.label, quantity: 1, unitPrice: amt.value, optionIdentity: null, metadata: {} });
        else if (amt.empty) requireAmount("carwash", cw.menuId, `「${opt.label}」の金額が未入力です。`);
        else invalidAmount("carwash", cw.menuId, `「${opt.label}」の金額が不正です。`);
      }
    }
  }

  // ── Room Cleaning — MULTIPLE menus, one amount each ────────────────────────────
  if (selected.includes("roomclean")) {
    const rc = cfg.roomCleaning;
    if (rc.selectedMenuIds.length === 0) {
      requireAmount("roomclean", null, "ルームクリーニングのメニューを選択してください。");
    }
    for (const id of rc.selectedMenuIds) {
      const opt = lookup(config.roomCleaningMenus, id);
      if (!opt) {
        unknownItem("roomclean", id);
        continue;
      }
      const amt = parseAmount(rc.unitPricesByMenu[id]);
      if (amt.ok) lines.push({ sourceCategory: "roomclean", manualPricingIdentity: id, label: opt.label, quantity: 1, unitPrice: amt.value, optionIdentity: null, metadata: {} });
      else if (amt.empty) requireAmount("roomclean", id, `「${opt.label}」の金額が未入力です。`);
      else invalidAmount("roomclean", id, `「${opt.label}」の金額が不正です。`);
    }
  }

  // ── Other Work — custom rows are OPERATOR-AUTHORED; presets stay preview-only ──
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
      const qtyNote = row.quantity.trim();
      if (qtyNote !== "" && qtyNote !== "1") {
        warnings.push(issue(WIZARD_PRICING_WARNINGS.PREVIEW_ONLY_ITEM, `「${name}」の数量（${qtyNote}）は現状の計算に反映されません（単価のみ計算）。`, "other", row.id));
      }
      // The operator's own typed name — the one label no configuration may override.
      lines.push({ sourceCategory: "other", manualPricingIdentity: row.id, label: name, quantity: 1, unitPrice: amt.value, optionIdentity: null, metadata: { quantityInput: qtyNote } });
    }
  }

  // ── Store Global Options — cross-category ─────────────────────────────────────
  for (const id of cfg.storeGlobalOptions.selectedOptionIds) {
    const opt = lookup(config.storeGlobalOptions, id);
    if (!opt) {
      unknownItem("store_global_options", id);
      continue;
    }
    // Classification comes from configuration, never from the label.
    //
    // BLOCKING (Phase 8-B2F-BH). The operator selected this option, so it is either billed or the
    // apply stops. Dropping it with a warning — the previous behaviour — meant a billable service
    // mis-marked `priceable: false` disappeared from the estimate silently, because the container
    // surfaces only blocking reasons. No line is produced, and the plan becomes `blocked`, whose
    // union arm carries neither `patch` nor `items`.
    if (!opt.priceable) {
      errors.push(issue(
        WIZARD_PRICING_CONFIG_ERRORS.NON_PRICEABLE_SELECTED_ITEM,
        `「${opt.label}」は価格対象外のため、この内容では反映できません。選択を解除してください。`,
        "store_global_options",
        id,
      ));
      continue;
    }
    const amt = parseAmount(cfg.storeGlobalOptions.unitPricesByOption[id]);
    let quantity = 1;
    if (opt.quantityRequired) {
      const minQty = opt.minQuantity;
      const maxQty = opt.maxQuantity;
      const raw = cfg.storeGlobalOptions.quantitiesByOption[id];
      const q = raw == null ? minQty : raw;
      if (!Number.isInteger(q) || q < minQty || (maxQty != null && q > maxQty)) {
        errors.push(issue(WIZARD_PRICING_ERRORS.INVALID_QUANTITY, `「${opt.label}」の数量が不正です。`, "store_global_options", id));
        continue;
      }
      quantity = q;
    }
    if (amt.ok) {
      lines.push({ sourceCategory: "store_global_options", manualPricingIdentity: id, label: opt.label, quantity, unitPrice: amt.value, optionIdentity: null, metadata: { quantityRequired: opt.quantityRequired } });
    } else if (amt.empty) requireAmount("store_global_options", id, `「${opt.label}」の金額が未入力です。`);
    else invalidAmount("store_global_options", id, `「${opt.label}」の金額が不正です。`);
  }

  return { lines, warnings, errors };
}
