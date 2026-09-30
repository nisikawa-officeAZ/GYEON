"use client";

// EW-UI-3C — Canonical Step-4 binding host.
//
// Replaces the Phase-1 placeholder with the controlled Screen-4 selector UI. It renders ONLY the
// Step-3-selected categories as main sections (plus Store Global Options as the cross-category 8th
// section) and binds every business-state write through the single canonical route:
//
//   selector event → step4 binding → api.updateStore({ services: { <section>: <patch> } })
//                  → applyStorePatch → updateServiceConfiguration → new EstimateWizardDraftV22
//
// It NEVER mutates api.draft or serviceConfiguration directly, holds NO second copy of services or
// selected categories, and runs NO pricing/save/OCR/DB. Trusted runtime inputs (shopRank +
// screenConfig) arrive as props from EstimateWizard and are used here only — they are never stored
// in WizardStore, the canonical draft, or hook state. Display prices come only from screenConfig;
// PPF price/coefficient placeholders stay null. This is NOT the production reference container and
// imports nothing from alternate production containers or screens/ScreensPreview.

import { useState } from "react";

import {
  SERVICE_CATEGORY_IDS,
  SERVICE_FAMILIES,
  SERVICE_FAMILY_CATEGORY,
  serviceFamilyForCategory,
  type ServiceFamily,
} from "@/lib/estimates/service-categories";
import type { EstimateWizardApi } from "../useEstimateWizard";
import type { WizardRuntimeInputs } from "../contract/wizard-runtime-inputs";
import type { WizardStorePatch } from "../bridge/ew-ui1-to-draft";
import type { WizardDedicatedMenuDraft } from "../draft/wizard-draft-types";
import type { WheelMenu, GlassMenu, OtherCoatingMenu } from "../screens/step-types";

import { Step4Estimate as Step4EstimateShell } from "../screens/Step4Estimate";
import { CoatingSelector } from "../screens/CoatingSelector";
import { PpfSelector } from "../screens/PpfSelector";
import { WindowFilmSelector } from "../screens/WindowFilmSelector";
import { BodyMaintenanceSelector } from "../screens/BodyMaintenanceSelector";
import { CarWashSelector } from "../screens/CarWashSelector";
import { RoomCleaningSelector } from "../screens/RoomCleaningSelector";
import { OtherWorkSelector } from "../screens/OtherWorkSelector";
import { StoreGlobalOptionsSelector } from "../screens/StoreGlobalOptionsSelector";
import {
  isCoatingAvailableForRank,
  firstLayerOptions,
  secondLayerOptionsForRank,
  thirdLayerOptionsForRank,
} from "../screens/coating-matrix";

import {
  createStep4Bindings,
  dedicatedMenuDraftOf,
  initialDedicatedMenuQuantity,
  isDedicatedMenuUsable,
  isQuantityWithinMenuBounds,
  initialOtherCoatingQuantity,
  isOtherCoatingFixedOne,
  otherCoatingDraftOf,
  toOtherCoatingMenuRef,
  type DedicatedMenuActionResult,
  type DedicatedMenuBindings,
  type DedicatedMenuKind,
  type OtherCoatingBindings,
  type RowCreateResult,
} from "./step4-bindings";
import {
  isWindowFilmV1RuntimeReady,
  windowFilmV1SuggestedUnitPrice,
} from "../screens/window-film-v1-suggested-price";

/** Concise, operator-facing message when secure row-ID generation fails closed (no patch applied). */
const ROW_ID_ERROR_MESSAGE = "行を追加できませんでした。もう一度お試しください。";

/**
 * Rank locks — UNCHANGED, and now limited to coating only.
 *
 * B2-E2G: `coating` is deliberately outside the service-offering model, so its rank rule survives
 * exactly as before. Every rank lock on a MANAGED family is gone: PPF's `shop` rule and window
 * film's rank rules are both retired, because rank no longer decides eligibility for any of the
 * five managed families — the dealer's own opt-in does.
 */
const COATING_LOCK_REASON = "GYEON PPFインストーラーはコーティングを施工できません。";

/**
 * Setup-required copy per managed family, used ONLY when the dealer has opted in but the family's
 * prerequisites are not satisfied.
 *
 * The split between "the dealer can fix this" and "only an administrator can" is deliberate and is
 * the whole reason these are separate strings. Four families are configured from dealer-owned
 * catalog data, so their message names the settings destination in TEXT (no link element is
 * introduced into any selector). PPF's prerequisites are GLOBAL rows the dealer cannot author, so
 * sending them to settings would send them somewhere that cannot help. A message must never be
 * broader than the condition it names.
 */
const SETUP_REQUIRED_REASON: Readonly<Record<ServiceFamily, string>> = {
  window_film:
    "ウィンドウフィルムを利用するには、見積設定（見積ウィザード設定）でフィルム種類を登録してください。",
  maintenance:
    "ボディ定期メンテナンスを利用するには、見積設定（見積ウィザード設定）でメンテナンスメニューを登録してください。",
  car_wash:
    "メンテナンス洗車を利用するには、見積設定（見積ウィザード設定）で洗車メニューを登録してください。",
  room_cleaning:
    "ルームクリーニングを利用するには、見積設定（見積ウィザード設定）でルームクリーニングメニューを登録してください。",
  ppf: "PPFの施工メニューが利用できません。管理者にお問い合わせください。",
};

/**
 * Window film has a SECOND incomplete state the dealer cannot fix: film types exist, but no
 * installation areas resolve. Areas are global rows, so this one is administrator-only.
 */
const WINDOW_AREAS_UNAVAILABLE_REASON =
  "ウィンドウフィルム設定で、提供する部位またはセットの金額と所要時間を登録してください。";

/**
 * GDA-ESTIMATE-PPF-OFFERING-R1-A — the compact attached action offered from the coating section
 * when the operator has not selected the main PPF category. Exact label per the frozen directive.
 */
const ATTACHED_PARTIAL_PPF_LABEL = "部分PPFを追加";

/**
 * Pure, directly testable canonical patch for the attached-partial-PPF action. It reuses the
 * EXISTING `ppf` category and the existing `services.ppf.installationMethod` field — no second
 * PPF model, category, price route, or line identity. The existing category order is preserved;
 * `ppf` is appended only when absent, so calling this twice never duplicates it.
 */
export function attachedPartialPpfPatch(categories: readonly string[]): WizardStorePatch {
  return {
    categories: categories.includes("ppf") ? categories : [...categories, "ppf"],
    services: { ppf: { installationMethod: "partial" } },
  };
}

/**
 * GDA-ESTIMATE-SAVE-PRICING-GUARD-R1 — the host-derived PPF pricing readiness. A minimal
 * boolean/reason ONLY: the catalog and pricing configuration it is derived from never reach this
 * step. Both unready reasons are dealer-fixable in Settings > PPF種類・施工係数, so the lock copy
 * names that destination instead of the administrator.
 */
export type PpfPricingReadiness =
  | { readonly ready: true }
  | { readonly ready: false; readonly reason: "price-table-missing" | "coefficient-missing" };

const PPF_PRICING_REASON: Readonly<Record<"price-table-missing" | "coefficient-missing", string>> = {
  "price-table-missing":
    "PPFを利用するには、設定 > PPF種類・施工係数 でPPFの基準価格表を保存してください。",
  "coefficient-missing":
    "PPFを利用するには、設定 > PPF種類・施工係数 ですべてのPPF種類の施工係数を登録してください。",
};

// ── GDA-ESTIMATE-QUANTITY-POLICY-R1 (B5b2): dedicated wheel / glass sections ─────────────────
//
// `wheel` and `glass` are independent Screen-3 categories (plan §24.1). They belong to NO offering
// family and are NOT store-global options: the dealer-authored `wheel_menu` / `glass_menu` row is
// the sole availability authority, so this host reads `screenConfig.wheelMenus` / `glassMenus`
// and nothing else. Three states, kept deliberately distinct:
//   • collection ABSENT (`undefined`) → wiring/legacy state → FAIL CLOSED: locked, nothing selectable,
//     and NOT described as "no menus" (nobody proved that);
//   • collection EMPTY (`[]`)        → the dealer has authored none → settings-required text;
//   • rows present                  → the menus render; each is selectable only if well-formed.
// Every write goes selector event → binding → api.updateStore({ services: { wheel|glass } }).
// No subtotal or tax is computed here; the configured price is DISPLAYED and prefilled as text.

interface DedicatedMenuSectionCopy {
  readonly title: string;
  readonly unit: string;
  readonly setupRequired: string;
  readonly unavailable: string;
}

const DEDICATED_MENU_COPY: Readonly<Record<DedicatedMenuKind, DedicatedMenuSectionCopy>> = {
  wheel: {
    title: "ホイール施工メニュー",
    unit: "本",
    setupRequired: "ホイールを利用するには、見積設定（見積ウィザード設定）でホイールメニューを登録してください。",
    unavailable: "ホイールメニューの情報を取得できませんでした。この状態ではホイールを選択できません。画面を再読み込みしても解消しない場合は管理者にお問い合わせください。",
  },
  glass: {
    title: "ガラス施工メニュー",
    unit: "枚",
    setupRequired: "ガラスを利用するには、見積設定（見積ウィザード設定）でガラスメニューを登録してください。",
    unavailable: "ガラスメニューの情報を取得できませんでした。この状態ではガラスを選択できません。画面を再読み込みしても解消しない場合は管理者にお問い合わせください。",
  },
};

const DEDICATED_MENU_HINT = "税抜単価 × 数量で見積に計上されます。複数のメニューを選択できます。";
const DEDICATED_MENU_ROW_INVALID = "このメニューは数量範囲または単価の設定が不正なため選択できません。見積設定を確認してください。";
const DEDICATED_MENU_PRICE_REQUIRED = "単価が未設定です。税抜単価を入力するか、見積設定で単価を登録してください。";
const DEDICATED_MENU_QUANTITY_REQUIRED = "数量が未設定です。＋で初期数量を設定してください。";

const DEDICATED_MENU_ACTION_MESSAGE: Readonly<Record<"menu-invalid" | "quantity-out-of-bounds", string>> = {
  "menu-invalid": DEDICATED_MENU_ROW_INVALID,
  "quantity-out-of-bounds": "数量は設定された範囲内で入力してください。",
};

/**
 * GDA-PR143-R2 — a SELECTED wheel / glass row can hold a draft quantity that the CURRENT catalogue
 * bounds reject (the dealer tightened min/max after the draft was written). The builder refuses to
 * price that line (fail closed), so this host must SHOW the actual stale value instead of a bare
 * "unset" and offer an explicit one-click repair through the SAME existing binding
 * (`onQuantityChange(menu, target)` → one section-scoped patch). Nothing is clamped or cleared on
 * mount, and the draft is never rewritten without the operator's activation.
 */
const dedicatedMenuBoundsText = (menu: { readonly minQty: number; readonly maxQty: number | null }): string =>
  menu.maxQty !== null ? `最小${menu.minQty}・最大${menu.maxQty}` : `最小${menu.minQty}`;
const dedicatedMenuStaleQuantityNotice = (stale: number, menu: { readonly minQty: number; readonly maxQty: number | null }): string =>
  `下書きに残った数量「${stale}」は現在の数量範囲（${dedicatedMenuBoundsText(menu)}）外のため使用できません。`;
const dedicatedMenuStaleQuantityRepairLabel = (target: number): string => `数量を${target}に修正`;

/**
 * PURE: the explicit repair target for a stale dedicated-menu quantity — the NEAREST configured
 * bound (below min → min; above max → max; a non-integer inside the range → rounded and clamped).
 * `null` when the bounds themselves are malformed (nothing can be offered) or the value is already
 * valid (nothing to repair). Display-only: the write still goes through the validating binding.
 */
export function repairedDedicatedMenuQuantity(
  stale: number,
  menu: { readonly minQty: number; readonly maxQty: number | null },
): number | null {
  const { minQty, maxQty } = menu;
  if (!Number.isSafeInteger(minQty) || minQty < 1) return null;
  if (maxQty !== null && (!Number.isSafeInteger(maxQty) || maxQty < minQty)) return null;
  if (Number.isSafeInteger(stale) && stale >= minQty && (maxQty === null || stale <= maxQty)) return null;
  if (!Number.isFinite(stale)) return minQty;
  const rounded = Math.round(stale);
  if (rounded < minQty) return minQty;
  if (maxQty !== null && rounded > maxQty) return maxQty;
  return rounded;
}

/** A menu section is usable only when the runtime collection is present AND non-empty. */
const dedicatedMenusLocked = (menus: readonly (WheelMenu | GlassMenu | OtherCoatingMenu)[] | undefined): boolean =>
  menus === undefined || menus.length === 0;

function DedicatedMenuLockCard({ title, reason }: { title: string; reason: string }) {
  return (
    <div className="bg-[#1e293b] rounded-xl shadow-lg p-5">
      <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{title}</h3>
      <p className="text-xs text-amber-300/90 mt-3">{reason}</p>
    </div>
  );
}

/**
 * Presentation-only dedicated menu section. Reads the canonical section projection and the trusted
 * runtime menus; every change is routed through the supplied bindings. Holds no state of its own.
 */
function DedicatedMenuSection({ kind, menus, draft, bindings, onResult }: {
  kind: DedicatedMenuKind;
  menus: readonly (WheelMenu | GlassMenu)[] | undefined;
  draft: WizardDedicatedMenuDraft;
  bindings: DedicatedMenuBindings;
  onResult: (r: DedicatedMenuActionResult) => void;
}) {
  const copy = DEDICATED_MENU_COPY[kind];
  if (menus === undefined) return <DedicatedMenuLockCard title={copy.title} reason={copy.unavailable} />;
  if (menus.length === 0) return <DedicatedMenuLockCard title={copy.title} reason={copy.setupRequired} />;

  return (
    <div className="bg-[#1e293b] rounded-xl shadow-lg p-5">
      <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{copy.title}</h3>
      <p className="text-[11px] text-slate-500 mt-1">{DEDICATED_MENU_HINT}</p>
      <ul className="mt-3 flex flex-col gap-2">
        {menus.map((menu) => {
          const usable = isDedicatedMenuUsable(menu);
          const selected = draft.selectedMenuIds.includes(menu.id);
          const draftQty: number | undefined = draft.quantitiesByMenu[menu.id];
          // Only a draft quantity that is valid for THESE bounds is the effective quantity; anything
          // else is NOT displayed as the quantity. GDA-PR143-R2: a PRESENT draft value the current
          // bounds reject is a STALE quantity — surfaced verbatim below with an explicit repair, never
          // silently clamped, cleared or shown as the effective number.
          const qty = draftQty !== undefined && isQuantityWithinMenuBounds(draftQty, menu) ? draftQty : null;
          const staleQty = draftQty !== undefined && qty === null ? draftQty : null;
          const repairTarget = staleQty !== null ? repairedDedicatedMenuQuantity(staleQty, menu) : null;
          const priceText: string = draft.unitPricesByMenu[menu.id] ?? "";
          const initial = initialDedicatedMenuQuantity(kind, menu);
          // GDA-PR143-R2: only a POSITIVE configured price is a price; null (and a persisted 0 that a
          // non-resolver caller might still hand over) reads as not configured — never "¥0".
          const configuredPriceLabel = menu.defaultUnitPrice !== null && menu.defaultUnitPrice > 0
            ? `税抜 ¥${menu.defaultUnitPrice.toLocaleString("ja-JP")} / ${copy.unit}`
            : "単価未設定";
          const boundsLabel = menu.maxQty !== null
            ? `（最小${menu.minQty}・最大${menu.maxQty}）`
            : `（最小${menu.minQty}）`;
          const decrementDisabled = qty === null || qty <= menu.minQty;
          const incrementDisabled = qty !== null && menu.maxQty !== null && qty >= menu.maxQty;
          return (
            <li key={menu.id} className={`rounded-lg border p-3 ${selected ? "border-[#1d4ed8] bg-blue-950/30" : "border-slate-700 bg-[#0f172a]"}`}>
              <button
                type="button"
                aria-pressed={selected}
                disabled={!usable}
                onClick={usable ? () => onResult(bindings.onMenuToggle(menu)) : undefined}
                className="w-full min-h-[44px] flex items-center justify-between gap-3 text-left disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="text-sm text-slate-100">{menu.name}</span>
                <span className="text-xs text-slate-400 shrink-0">{configuredPriceLabel}</span>
              </button>
              {!usable && (
                <p className="text-[11px] text-amber-300/90 mt-1">
                  {menu.disabled ? (menu.disabledReason ?? DEDICATED_MENU_ROW_INVALID) : DEDICATED_MENU_ROW_INVALID}
                </p>
              )}
              {selected && usable && (
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className="flex flex-col gap-1 text-[11px] text-slate-400">
                    <span>税抜単価（円）</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={priceText}
                      aria-label={`${menu.name} 税抜単価`}
                      onChange={(e) => bindings.onUnitPriceChange(menu.id, e.target.value)}
                      className="min-h-[44px] rounded-lg bg-[#0f172a] border border-slate-700 px-3 text-sm text-slate-100 tabular-nums"
                    />
                    {priceText === "" && <span className="text-amber-300/90">{DEDICATED_MENU_PRICE_REQUIRED}</span>}
                  </label>
                  <div className="flex flex-col gap-1 text-[11px] text-slate-400">
                    <span>数量（{copy.unit}）{boundsLabel}</span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        aria-label={`${menu.name} 数量を減らす`}
                        disabled={decrementDisabled}
                        onClick={qty === null ? undefined : () => onResult(bindings.onQuantityChange(menu, qty - 1))}
                        className="min-h-[44px] min-w-[44px] rounded-lg border border-slate-700 bg-[#0f172a] text-slate-100 disabled:opacity-40"
                      >
                        −
                      </button>
                      <span className="min-w-[2ch] text-center text-sm text-slate-100 tabular-nums">{qty ?? "—"}</span>
                      <button
                        type="button"
                        aria-label={`${menu.name} 数量を増やす`}
                        disabled={incrementDisabled || initial === null}
                        onClick={initial === null ? undefined : () => onResult(bindings.onQuantityChange(menu, qty === null ? initial : qty + 1))}
                        className="min-h-[44px] min-w-[44px] rounded-lg border border-slate-700 bg-[#0f172a] text-slate-100 disabled:opacity-40"
                      >
                        ＋
                      </button>
                    </div>
                    {qty === null && staleQty === null && <span className="text-amber-300/90">{DEDICATED_MENU_QUANTITY_REQUIRED}</span>}
                    {staleQty !== null && (
                      // GDA-PR143-R2: the stale draft value is shown, not hidden behind "unset"; the
                      // ONLY way it changes is the operator's activation of this repair, which writes
                      // the nearest configured bound through the existing validating binding.
                      <>
                        <span data-testid="dedicated-menu-stale-quantity-notice" className="text-amber-300/90">
                          {dedicatedMenuStaleQuantityNotice(staleQty, menu)}
                        </span>
                        {repairTarget !== null && (
                          <button
                            type="button"
                            data-testid="dedicated-menu-stale-quantity-repair"
                            aria-label={`${menu.name} ${dedicatedMenuStaleQuantityRepairLabel(repairTarget)}`}
                            onClick={() => onResult(bindings.onQuantityChange(menu, repairTarget))}
                            className="min-h-[44px] rounded-lg border border-amber-500/60 bg-[#0f172a] px-3 text-sm text-amber-200"
                          >
                            {dedicatedMenuStaleQuantityRepairLabel(repairTarget)}
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ── GDA-OTHER-COATINGS-R1 (C3): the distinct `other_coating` section ────────────────────────────
//
// A DISTINCT Screen-3 category with its own draft section (`services.otherCoating`) and its own
// runtime collection (`screenConfig.otherCoatingMenus`). Same three availability states as
// wheel/glass (absent → fail closed; empty → settings required; rows → selectable if well-formed).
// Per row, quantity is READ from the dealer item:
//   • fixed-one (`quantityRequired: false`) → the effective quantity is exactly 1 and NO quantity
//     control renders (nothing to edit);
//   • quantity-bearing (`quantityRequired: true`) → the B5b2 stepper with the configured bounds.
// A POSITIVE configured price is displayed and prefilled as text; null / 0 shows "単価未設定" and
// the price text stays empty for manual positive entry — never a prepared ¥0 line.
const OTHER_COATING_COPY: DedicatedMenuSectionCopy = {
  title: "その他コーティングメニュー",
  unit: "点",
  setupRequired: "その他コーティングを利用するには、見積設定（見積ウィザード設定）でその他コーティングメニューを登録してください。",
  unavailable: "その他コーティングメニューの情報を取得できませんでした。この状態ではその他コーティングを選択できません。画面を再読み込みしても解消しない場合は管理者にお問い合わせください。",
};
const OTHER_COATING_HINT = "税抜単価 × 数量で見積に計上されます。数量固定の項目は1点として計上されます。複数の項目を選択できます。";
const OTHER_COATING_FIXED_ONE_LABEL = "数量：1（固定）";
/**
 * GDA-OTHER-COATINGS-R1 (C5 F1) — a restored, SELECTED fixed-one row can still hold a stale draft
 * quantity (e.g. 3) written while the dealer item was quantity-bearing. The builder refuses to price
 * that line (fail closed, never silently 1), so this host must SHOW the contradiction instead of the
 * static fixed label and offer an explicit one-click repair through the SAME existing binding
 * (`onQuantityChange(menu, 1)` → one `otherCoating`-scoped patch). Nothing is normalised on mount.
 */
const otherCoatingStaleFixedOneNotice = (stale: number): string =>
  `下書きに残った数量「${stale}」は使用できません。この項目の数量は1（固定）です。`;
const OTHER_COATING_STALE_FIXED_ONE_RESET_LABEL = "数量を1に戻す";

function OtherCoatingSection({ menus, draft, bindings, onResult }: {
  menus: readonly OtherCoatingMenu[] | undefined;
  draft: WizardDedicatedMenuDraft;
  bindings: OtherCoatingBindings;
  onResult: (r: DedicatedMenuActionResult) => void;
}) {
  const copy = OTHER_COATING_COPY;
  if (menus === undefined) return <DedicatedMenuLockCard title={copy.title} reason={copy.unavailable} />;
  if (menus.length === 0) return <DedicatedMenuLockCard title={copy.title} reason={copy.setupRequired} />;

  return (
    <div className="bg-[#1e293b] rounded-xl shadow-lg p-5">
      <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{copy.title}</h3>
      <p className="text-[11px] text-slate-500 mt-1">{OTHER_COATING_HINT}</p>
      <ul className="mt-3 flex flex-col gap-2">
        {menus.map((menu) => {
          // The row is normalised ONCE into the dedicated-menu contract; every rule below reads it.
          const ref = toOtherCoatingMenuRef(menu);
          const usable = isDedicatedMenuUsable(ref);
          const fixedOne = isOtherCoatingFixedOne(menu);
          const selected = draft.selectedMenuIds.includes(menu.id);
          const draftQty: number | undefined = draft.quantitiesByMenu[menu.id];
          const qty = draftQty !== undefined && isQuantityWithinMenuBounds(draftQty, ref) ? draftQty : null;
          const priceText: string = draft.unitPricesByMenu[menu.id] ?? "";
          const initial = initialOtherCoatingQuantity(ref);
          // C5 F1: a selected fixed-one row whose draft quantity is PRESENT and not 1 is a contradiction
          // the pricing route fails closed on; surface it and offer the reset — never auto-repair.
          const staleFixedOneQty = fixedOne && draftQty !== undefined && draftQty !== 1 ? draftQty : null;
          const configuredPriceLabel = ref.defaultUnitPrice !== null
            ? `税抜 ¥${ref.defaultUnitPrice.toLocaleString("ja-JP")} / ${copy.unit}`
            : "単価未設定";
          const boundsLabel = ref.maxQty !== null
            ? `（最小${ref.minQty}・最大${ref.maxQty}）`
            : `（最小${ref.minQty}）`;
          const decrementDisabled = qty === null || qty <= ref.minQty;
          const incrementDisabled = qty !== null && ref.maxQty !== null && qty >= ref.maxQty;
          return (
            <li key={menu.id} className={`rounded-lg border p-3 ${selected ? "border-[#1d4ed8] bg-blue-950/30" : "border-slate-700 bg-[#0f172a]"}`}>
              <button
                type="button"
                aria-pressed={selected}
                disabled={!usable}
                onClick={usable ? () => onResult(bindings.onMenuToggle(menu)) : undefined}
                className="w-full min-h-[44px] flex items-center justify-between gap-3 text-left disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="text-sm text-slate-100">{menu.name}</span>
                <span className="text-xs text-slate-400 shrink-0">{configuredPriceLabel}</span>
              </button>
              {!usable && (
                <p className="text-[11px] text-amber-300/90 mt-1">
                  {menu.disabled ? (menu.disabledReason ?? DEDICATED_MENU_ROW_INVALID) : DEDICATED_MENU_ROW_INVALID}
                </p>
              )}
              {selected && usable && (
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className="flex flex-col gap-1 text-[11px] text-slate-400">
                    <span>税抜単価（円）</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={priceText}
                      aria-label={`${menu.name} 税抜単価`}
                      onChange={(e) => bindings.onUnitPriceChange(menu.id, e.target.value)}
                      className="min-h-[44px] rounded-lg bg-[#0f172a] border border-slate-700 px-3 text-sm text-slate-100 tabular-nums"
                    />
                    {priceText === "" && <span className="text-amber-300/90">{DEDICATED_MENU_PRICE_REQUIRED}</span>}
                  </label>
                  {fixedOne ? (
                    // Fixed-one: the effective quantity is exactly 1 — displayed, never editable.
                    <div className="flex flex-col gap-1 text-[11px] text-slate-400">
                      <span>数量（{copy.unit}）</span>
                      {staleFixedOneQty === null ? (
                        <span className="min-h-[44px] flex items-center text-sm text-slate-100 tabular-nums">{OTHER_COATING_FIXED_ONE_LABEL}</span>
                      ) : (
                        // C5 F1: the stale draft value is shown, not hidden behind the fixed label; the
                        // ONLY way it changes is the operator's activation of this reset, which writes
                        // exactly 1 through the existing binding (bounds {1,1} accept it).
                        <>
                          <span data-testid="other-coating-fixed-one-stale-notice" className="text-amber-300/90">
                            {otherCoatingStaleFixedOneNotice(staleFixedOneQty)}
                          </span>
                          <button
                            type="button"
                            data-testid="other-coating-fixed-one-stale-reset"
                            aria-label={`${menu.name} ${OTHER_COATING_STALE_FIXED_ONE_RESET_LABEL}`}
                            onClick={() => onResult(bindings.onQuantityChange(menu, 1))}
                            className="min-h-[44px] rounded-lg border border-amber-500/60 bg-[#0f172a] px-3 text-sm text-amber-200"
                          >
                            {OTHER_COATING_STALE_FIXED_ONE_RESET_LABEL}
                          </button>
                        </>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-col gap-1 text-[11px] text-slate-400">
                      <span>数量（{copy.unit}）{boundsLabel}</span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          aria-label={`${menu.name} 数量を減らす`}
                          disabled={decrementDisabled}
                          onClick={qty === null ? undefined : () => onResult(bindings.onQuantityChange(menu, qty - 1))}
                          className="min-h-[44px] min-w-[44px] rounded-lg border border-slate-700 bg-[#0f172a] text-slate-100 disabled:opacity-40"
                        >
                          −
                        </button>
                        <span className="min-w-[2ch] text-center text-sm text-slate-100 tabular-nums">{qty ?? "—"}</span>
                        <button
                          type="button"
                          aria-label={`${menu.name} 数量を増やす`}
                          disabled={incrementDisabled || initial === null}
                          onClick={initial === null ? undefined : () => onResult(bindings.onQuantityChange(menu, qty === null ? initial : qty + 1))}
                          className="min-h-[44px] min-w-[44px] rounded-lg border border-slate-700 bg-[#0f172a] text-slate-100 disabled:opacity-40"
                        >
                          ＋
                        </button>
                      </div>
                      {qty === null && <span className="text-amber-300/90">{DEDICATED_MENU_QUANTITY_REQUIRED}</span>}
                    </div>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export interface Step4EstimateProps extends WizardRuntimeInputs {
  api: EstimateWizardApi;
  /** REQUIRED — no default. Absence would be a wiring failure, not "ready". */
  ppfPricingReadiness: PpfPricingReadiness;
}

export function Step4Estimate({ api, shopRank, screenConfig, ppfPricingReadiness }: Step4EstimateProps) {
  // Local UI-only state — NOTHING else lives here (no second copy of services or categories).
  const [activeSection, setActiveSection] = useState<string>("coating");
  const [actionError, setActionError] = useState<string | null>(null);

  const categories = api.store.categories;
  const cfg = api.store.services; // canonical projection (read-only)
  const bindings = createStep4Bindings(cfg, api.updateStore);

  // Resolve the open section against the CURRENT selection. A deselected active section falls back
  // to the first selected canonical category — WITHOUT deleting that section's saved configuration
  // (category selection and service configuration are separate canonical fields).
  // ── B2-E2G: managed service-family visibility ─────────────────────────────────────────────────
  // OPTED OUT  → the family's section is ABSENT: filtered out of the sections this screen presents,
  //              so no tab, no content and no lock card, and NO setup prompt. A dealer who does not
  //              offer a service has nothing to fix and must never be nagged to configure it. The
  //              canonical draft is untouched, so opting back in restores their Screen-3 selection
  //              and saved configuration intact.
  // OPTED IN   → the section is PRESENT, and locked only while its prerequisites are unsatisfied.
  //
  // Both effects are confined to the one family. Every other enabled family, and both unmanaged
  // categories, are unaffected — so an incomplete setup can never block an estimate for a service
  // the dealer HAS configured.
  const offerings = screenConfig.serviceOfferings;

  /** Prerequisites per managed family. Rank appears nowhere. */
  // PPF needs BOTH the global catalog rows (administrator-owned) AND the dealer's authoritative
  // pricing inputs (R1 price table + every product's install coefficient). Catalog rows alone once
  // reported "ready" and let an unpriceable PPF selection reach Step 7, where save failed closed.
  const ppfCatalogComplete = screenConfig.ppfMethods.length > 0
    && screenConfig.ppfParts.length > 0
    && screenConfig.ppfTypeGroups.length > 0;
  const familyComplete: Readonly<Record<ServiceFamily, boolean>> = {
    window_film: isWindowFilmV1RuntimeReady(screenConfig),
    ppf: ppfCatalogComplete && ppfPricingReadiness.ready,
    maintenance: screenConfig.maintenanceMenus.length > 0,
    car_wash: screenConfig.washMenus.length > 0,
    room_cleaning: screenConfig.roomMenus.length > 0,
  };

  // An UNMANAGED category (coating, other) is always visible: it is outside this model entirely.
  const visibleCategories = categories.filter((id) => {
    const family = serviceFamilyForCategory(id);
    return family === null || offerings[family];
  });

  const orderedSelected = SERVICE_CATEGORY_IDS.filter((id) => visibleCategories.includes(id));
  // When the only selected category is an opted-out family, nothing remains to open and the shell
  // renders its no-selection placeholder — deliberately, rather than silently opening a section the
  // dealer did not choose.
  const resolvedActive = visibleCategories.includes(activeSection) ? activeSection : (orderedSelected[0] ?? "");

  // The ONLY surviving rank lock. Coating is outside the offering model (see the constant above).
  const coatingLocked = !isCoatingAvailableForRank(shopRank);

  // Incompleteness is evaluated only for families the dealer opted INTO — an opted-out family is
  // not "incomplete", and its section is already absent.
  const familyLocked = (family: ServiceFamily): boolean => offerings[family] && !familyComplete[family];

  const lockReasonFor = (family: ServiceFamily): string =>
    family === "window_film" && screenConfig.filmTypes.length > 0
      ? WINDOW_AREAS_UNAVAILABLE_REASON   // films exist; the missing half is the global areas
      // Global PPF rows present but dealer pricing incomplete → the dealer-fixable settings reason.
      : family === "ppf" && ppfCatalogComplete && !ppfPricingReadiness.ready
        ? PPF_PRICING_REASON[ppfPricingReadiness.reason]
        : SETUP_REQUIRED_REASON[family];

  const disabledSections = new Set<string>();
  if (coatingLocked) disabledSections.add("coating");
  for (const family of SERVICE_FAMILIES) {
    if (familyLocked(family)) disabledSections.add(SERVICE_FAMILY_CATEGORY[family]);
  }
  // B5b2 — dedicated wheel/glass: locked when the runtime collection is absent (fail closed) or
  // empty (settings required). The section stays VISIBLE because the operator selected it on
  // Screen 3; the content explains the state and offers nothing selectable.
  if (dedicatedMenusLocked(screenConfig.wheelMenus)) disabledSections.add("wheel");
  if (dedicatedMenusLocked(screenConfig.glassMenus)) disabledSections.add("glass");
  // C3 — the distinct other-coating category: same absent/empty lock rule over its own collection.
  if (dedicatedMenusLocked(screenConfig.otherCoatingMenus)) disabledSections.add("other_coating");

  // Row-creation callbacks surface the fail-closed result to the operator; success clears the notice.
  const withRowResult = (run: () => RowCreateResult) => () => setActionError(run().ok ? null : ROW_ID_ERROR_MESSAGE);
  // Dedicated-menu callbacks do the same with their own reasons.
  const noteMenuResult = (r: DedicatedMenuActionResult) => setActionError(r.ok ? null : DEDICATED_MENU_ACTION_MESSAGE[r.reason]);

  // ── GDA-ESTIMATE-PPF-OFFERING-R1-A — attached partial PPF from a coating-only-so-far selection ──
  // Visible only while the operator has not selected the main PPF category and the dealer offers
  // PPF at all; absent when PPF is off (opt-out) or already selected (the existing PPF tab and
  // full/partial flow remain authoritative in that case).
  const showAttachedPartialPpf = categories.includes("coating") && !categories.includes("ppf") && offerings.ppf;
  const attachedPartialPpfComplete = familyComplete.ppf;
  const onAttachPartialPpf = () => {
    api.updateStore(attachedPartialPpfPatch(categories));
    setActiveSection("ppf");
  };

  const sectionContent = (() => {
    switch (resolvedActive) {
      case "coating":
        return (
          <div className="flex flex-col gap-3">
            <CoatingSelector
              shopRank={shopRank}
              coatingLocked={coatingLocked}
              lockReason={COATING_LOCK_REASON}
              selectedLayerCount={cfg.coating.layerCount}
              selectedLayer1ProductId={cfg.coating.layer1Id}
              selectedLayer2ProductId={cfg.coating.layer2Id}
              selectedLayer3ProductId={cfg.coating.layer3Id}
              availableLayer1Products={firstLayerOptions(shopRank)}
              availableLayer2Products={secondLayerOptionsForRank(cfg.coating.layer1Id, shopRank)}
              availableLayer3Products={thirdLayerOptionsForRank(cfg.coating.layer1Id, shopRank)}
              onLayerCountChange={bindings.coating.onLayerCountChange}
              onLayer1Change={bindings.coating.onLayer1Change}
              onLayer2Change={bindings.coating.onLayer2Change}
              onLayer3Change={bindings.coating.onLayer3Change}
              onAddOrUpdate={() => {}}
            />
            {showAttachedPartialPpf && (
              <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-3 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={attachedPartialPpfComplete ? onAttachPartialPpf : undefined}
                  disabled={!attachedPartialPpfComplete}
                  className="self-start text-xs font-medium text-blue-400 border border-blue-500/30 bg-blue-500/5 hover:bg-blue-500/10 disabled:opacity-40 px-4 min-h-[44px] rounded-lg transition-colors"
                >
                  {ATTACHED_PARTIAL_PPF_LABEL}
                </button>
                {!attachedPartialPpfComplete && (
                  <p className="text-[11px] text-slate-500">{lockReasonFor("ppf")}</p>
                )}
              </div>
            )}
          </div>
        );
      case "ppf":
        return (
          <PpfSelector
            shopRank={shopRank}
            ppfLocked={familyLocked("ppf")}
            lockReason={lockReasonFor("ppf")}
            selectedInstallationMethod={cfg.ppf.installationMethod}
            installationMethods={screenConfig.ppfMethods}
            onInstallationMethodChange={bindings.ppf.onInstallationMethodChange}
            selectedFullCoverage={cfg.ppf.fullCoverage}
            onFullCoverageChange={bindings.ppf.onFullCoverageChange}
            selectedPartialPartIds={cfg.ppf.selectedPartIds}
            partialParts={screenConfig.ppfParts}
            quantitiesByPart={cfg.ppf.quantitiesByPart}
            onPartialPartToggle={bindings.ppf.onPartialPartToggle}
            onQuantityChange={bindings.ppf.onQuantityChange}
            selectedPpfTypeId={cfg.ppf.ppfTypeId}
            ppfTypes={screenConfig.ppfTypeGroups}
            onPpfTypeChange={bindings.ppf.onPpfTypeChange}
            interiorRows={cfg.ppf.interiorRows}
            onInteriorRowAdd={withRowResult(bindings.ppf.onInteriorRowAdd)}
            onInteriorRowUpdate={bindings.ppf.onInteriorRowUpdate}
            onInteriorRowDelete={bindings.ppf.onInteriorRowDelete}
            displayedUnitPrice={null}
            editableUnitPrice={cfg.ppf.unitPriceInput}
            onUnitPriceChange={bindings.ppf.onUnitPriceChange}
            vehicleCoefficientInput={cfg.ppf.vehicleCoefficientInput}
            onVehicleCoefficientChange={bindings.ppf.onVehicleCoefficientChange}
            coefficientDisplay={null}
            combinedServiceAdjustment={null}
            onAddOrUpdate={() => {}}
          />
        );
      case "window":
        return (
          <WindowFilmSelector
            shopRank={shopRank}
            windowLocked={familyLocked("window_film")}
            lockReason={lockReasonFor("window_film")}
            areas={screenConfig.windowAreas}
            selectedAreaIds={cfg.windowFilm.selectedAreaIds}
            onAreaToggle={bindings.windowFilm.onAreaToggle}
            filmTypes={screenConfig.filmTypes}
            selectedFilmTypeId={cfg.windowFilm.filmTypeId}
            onFilmTypeChange={bindings.windowFilm.onFilmTypeChange}
            packages={screenConfig.windowFilmPackages}
            selectedPackageCode={cfg.windowFilm.selectedPackageCode ?? null}
            onPackageChange={bindings.windowFilm.onPackageChange}
            options={screenConfig.windowFilmOptions}
            selectedOptionIds={cfg.windowFilm.selectedOptionIds ?? []}
            optionQuantities={cfg.windowFilm.optionQuantities ?? {}}
            onOptionToggle={bindings.windowFilm.onOptionToggle}
            onOptionQuantityChange={bindings.windowFilm.onOptionQuantityChange}
            displayedUnitPrice={
              windowFilmV1SuggestedUnitPrice(screenConfig, cfg.windowFilm)
            }
            editableUnitPrice={cfg.windowFilm.unitPriceInput}
            onUnitPriceChange={bindings.windowFilm.onUnitPriceChange}
            onAddOrUpdate={() => {}}
          />
        );
      case "maintenance":
        return (
          <BodyMaintenanceSelector
            maintenanceMenus={screenConfig.maintenanceMenus}
            selectedMaintenanceMenuId={cfg.bodyMaintenance.menuId}
            onMaintenanceMenuChange={bindings.bodyMaintenance.onMenuChange}
            displayedUnitPrice={
              cfg.bodyMaintenance.menuId
                ? (screenConfig.maintenanceMenus.find((m) => m.id === cfg.bodyMaintenance.menuId)?.defaultPrice ?? null)
                : null
            }
            editablePriceAllowed
            editableUnitPrice={cfg.bodyMaintenance.unitPriceInput}
            onUnitPriceChange={bindings.bodyMaintenance.onUnitPriceChange}
            informationalMessage={null}
            onAddOrUpdate={() => {}}
          />
        );
      case "carwash":
        return (
          <CarWashSelector
            washMenus={screenConfig.washMenus}
            selectedWashMenuId={cfg.carWash.menuId}
            onWashMenuChange={bindings.carWash.onMenuChange}
            displayedUnitPrice={
              cfg.carWash.menuId
                ? (screenConfig.washMenus.find((m) => m.id === cfg.carWash.menuId)?.defaultPrice ?? null)
                : null
            }
            editablePriceAllowed
            editableUnitPrice={cfg.carWash.unitPriceInput}
            onUnitPriceChange={bindings.carWash.onUnitPriceChange}
            informationalMessage={null}
            onAddOrUpdate={() => {}}
          />
        );
      case "roomclean":
        return (
          <RoomCleaningSelector
            roomMenus={screenConfig.roomMenus}
            selectedRoomMenuIds={cfg.roomCleaning.selectedMenuIds}
            onRoomMenuToggle={bindings.roomCleaning.onMenuToggle}
            editablePriceAllowed
            editableUnitPrices={cfg.roomCleaning.unitPricesByMenu}
            onUnitPriceChange={bindings.roomCleaning.onUnitPriceChange}
            informationalMessage={null}
            onAddOrUpdate={() => {}}
          />
        );
      case "wheel":
        return (
          <DedicatedMenuSection
            kind="wheel"
            menus={screenConfig.wheelMenus}
            draft={dedicatedMenuDraftOf(cfg, "wheel")}
            bindings={bindings.wheel}
            onResult={noteMenuResult}
          />
        );
      case "glass":
        return (
          <DedicatedMenuSection
            kind="glass"
            menus={screenConfig.glassMenus}
            draft={dedicatedMenuDraftOf(cfg, "glass")}
            bindings={bindings.glass}
            onResult={noteMenuResult}
          />
        );
      case "other_coating":
        return (
          <OtherCoatingSection
            menus={screenConfig.otherCoatingMenus}
            draft={otherCoatingDraftOf(cfg)}
            bindings={bindings.otherCoating}
            onResult={noteMenuResult}
          />
        );
      case "other":
        return (
          <OtherWorkSelector
            presetOtherWorkItems={screenConfig.otherWorkPresets}
            selectedPresetItemIds={cfg.otherWork.selectedPresetIds}
            onPresetItemToggle={bindings.otherWork.onPresetToggle}
            unitPricesByItem={cfg.otherWork.unitPricesByItem}
            onUnitPriceChange={bindings.otherWork.onUnitPriceChange}
            quantitiesByItem={cfg.otherWork.quantitiesByItem}
            onQuantityChange={bindings.otherWork.onQuantityChange}
            customRows={cfg.otherWork.customRows}
            onCustomRowAdd={withRowResult(bindings.otherWork.onCustomRowAdd)}
            onCustomRowUpdate={bindings.otherWork.onCustomRowUpdate}
            onCustomRowDelete={bindings.otherWork.onCustomRowDelete}
            informationalMessage={null}
            onAddOrUpdate={() => {}}
          />
        );
      default:
        return (
          <div className="bg-[#1e293b] rounded-xl shadow-lg p-5">
            <p className="text-xs text-slate-400">作業カテゴリを選択してください。</p>
          </div>
        );
    }
  })();

  return (
    <Step4EstimateShell
      selectedCategories={visibleCategories}
      activeSection={resolvedActive}
      onSelectSection={setActiveSection}
      disabledSections={disabledSections}
      globalOptionsSlot={
        <StoreGlobalOptionsSelector
          globalOptions={screenConfig.storeGlobalOptions}
          selectedCategoryIds={categories}
          selectedGlobalOptionIds={cfg.storeGlobalOptions.selectedOptionIds}
          unitPricesByOption={cfg.storeGlobalOptions.unitPricesByOption}
          quantitiesByOption={cfg.storeGlobalOptions.quantitiesByOption}
          onGlobalOptionToggle={bindings.storeGlobalOptions.onOptionToggle}
          onUnitPriceChange={bindings.storeGlobalOptions.onUnitPriceChange}
          onQuantityChange={bindings.storeGlobalOptions.onQuantityChange}
          informationalMessage={null}
          onAddOrUpdate={() => {}}
        />
      }
    >
      {actionError !== null && (
        <div role="alert" className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {actionError}
        </div>
      )}
      {sectionContent}
    </Step4EstimateShell>
  );
}
