"use client";

// Estimate Wizard Ver2.2 — Store Global Options section (Phase 4H, presentation-only).
//
// 追加サービスオプション — store-configured options that may be used across MULTIPLE service
// categories (e.g. 鉄粉除去 for Coating or PPF), NOT limited to Coating. MULTIPLE selection
// (re-click deselects). An option is shown only when it is enabled AND applies to at least one
// selected Screen3 category (or is configured for all categories). Applicability comes from the
// data (applicableCategoryIds / appliesToAllCategories) — nothing is hardcoded here. Visual
// cards only (no pull-down). Options, prices, disabled states arrive through PROPS. Editable
// unit price only when the option allows it; quantity only when required. The component performs
// NO total/discount/coupon/modifier calculation, creates NO estimate items, never mutates
// EstimateEditor state, calls no Server Actions, and touches no DB/inventory/calendar.
// `estimatedDurationMinutes` from the data contract is NOT displayed (kept for future workload).

import { formatYen, cn } from "../foundation/tokens";
import type { StoreGlobalOptionsSelectorProps, StoreGlobalOption } from "./step-types";

const CARD = "bg-[#1e293b] rounded-xl shadow-lg p-5";
const SECHDR = "text-xs font-semibold text-slate-400 uppercase tracking-wider";
const INPUT =
  "bg-[#0f172a] border border-slate-700 rounded-lg px-3 py-2.5 text-base sm:text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-[#1d4ed8] transition-colors";

function OptionCard({
  option,
  selected,
  disabled,
  disabledReason,
  onToggle,
}: {
  option: StoreGlobalOption;
  selected: boolean;
  disabled: boolean;
  disabledReason?: string;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={disabled ? undefined : onToggle}
      className={cn(
        "text-left rounded-lg border p-3 min-h-[64px] transition-colors flex flex-col gap-1",
        disabled
          ? "bg-[#0f172a] border-slate-800 text-slate-600 opacity-50 cursor-not-allowed"
          : selected
            ? "bg-blue-950/40 border-[#1d4ed8]"
            : "bg-[#0f172a] border-slate-700 hover:border-slate-500",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className={cn("text-sm font-medium truncate", disabled ? "text-slate-600" : "text-slate-100")}>{option.name}</span>
        <div className="flex items-center gap-1.5 shrink-0">
          {option.badge && !disabled && <span className="text-[9px] text-emerald-300 border border-emerald-600/40 rounded px-1 py-0.5">{option.badge}</span>}
          {selected && !disabled && <span aria-hidden className="text-blue-300 text-xs">✓</span>}
        </div>
      </div>
      {option.description && <span className="text-[11px] text-slate-500 truncate">{option.description}</span>}
      <span className={cn("text-sm tabular-nums", disabled ? "text-slate-600" : "text-slate-200")}>{formatYen(option.defaultPrice)}</span>
      {disabled && disabledReason && <span className="text-[10px] text-slate-500">（{disabledReason}）</span>}
    </button>
  );
}

export function StoreGlobalOptionsSelector(props: StoreGlobalOptionsSelectorProps) {
  const {
    globalOptions, selectedCategoryIds, selectedGlobalOptionIds,
    unitPricesByOption, quantitiesByOption,
    disabledOptionIds, disabledReasonByOption,
    informationalMessage, onGlobalOptionToggle, onUnitPriceChange, onQuantityChange, onAddOrUpdate,
  } = props;

  const disabledIds = new Set(disabledOptionIds ?? []);

  // Applicability: show only enabled options that apply to a selected category (or to all).
  const visible = [...globalOptions]
    .filter((o) => o.enabled !== false)
    .filter((o) => o.appliesToAllCategories || (o.applicableCategoryIds ?? []).some((c) => selectedCategoryIds.includes(c)))
    .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));

  const isDisabled = (o: StoreGlobalOption) => disabledIds.has(o.id);
  const reasonFor = (o: StoreGlobalOption) => disabledReasonByOption?.[o.id] ?? o.disabledReason;

  const selectedOptions = visible.filter((o) => selectedGlobalOptionIds.includes(o.id) && !isDisabled(o));

  return (
    <div className={CARD}>
      <h3 className={SECHDR}>追加サービスオプション</h3>
      <p className="text-[11px] text-slate-500 mt-1 mb-3">選択中の作業カテゴリに適用できる店舗オプションから選択します（複数選択可）。</p>

      {informationalMessage && (
        <div className="rounded-lg border border-slate-700/60 bg-slate-800/40 p-2.5 mb-3">
          <p className="text-[11px] text-slate-300">{informationalMessage}</p>
        </div>
      )}

      {/* オプション選択（複数・カード）*/}
      {visible.length === 0 ? (
        <p className="text-[11px] text-slate-500">
          選択中のカテゴリに適用できる追加サービスオプションはありません。店舗設定でオプションと適用カテゴリを登録できます。
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {visible.map((o) => (
            <OptionCard
              key={o.id}
              option={o}
              selected={selectedGlobalOptionIds.includes(o.id)}
              disabled={isDisabled(o)}
              disabledReason={reasonFor(o)}
              onToggle={() => onGlobalOptionToggle(o.id)}
            />
          ))}
        </div>
      )}

      {selectedOptions.length > 0 && (
        <p className="text-[11px] text-slate-400 mt-2">選択中: {selectedOptions.length} オプション</p>
      )}

      {/* 選択オプションの単価・数量（許可時のみ）*/}
      {selectedOptions.length > 0 && (
        <div className="rounded-lg border border-slate-700/60 p-3 mt-3 flex flex-col gap-2">
          <span className="text-[11px] text-slate-400">選択中オプションの単価・数量</span>
          {selectedOptions.map((o) => {
            const qty = quantitiesByOption[o.id] ?? o.minQty ?? 1;
            return (
              <div key={o.id} className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs text-slate-300 truncate">{o.name}</span>
                <div className="flex items-center gap-2">
                  {o.editableUnitPrice ? (
                    <input
                      type="number"
                      inputMode="numeric"
                      value={unitPricesByOption[o.id] ?? ""}
                      onChange={(e) => onUnitPriceChange(o.id, e.target.value)}
                      placeholder={String(o.defaultPrice)}
                      className={`${INPUT} w-28 text-right`}
                    />
                  ) : (
                    <span className="text-sm text-slate-200 tabular-nums">{formatYen(o.defaultPrice)}</span>
                  )}
                  {o.quantityRequired && (
                    <div className="flex items-center gap-1">
                      <button type="button" onClick={() => onQuantityChange(o.id, Math.max(o.minQty ?? 1, qty - 1))} className="w-8 h-8 rounded-md bg-slate-700 text-slate-200 text-sm">−</button>
                      <span className="w-7 text-center text-sm text-slate-100 tabular-nums">{qty}</span>
                      <button type="button" onClick={() => onQuantityChange(o.id, o.maxQty ? Math.min(o.maxQty, qty + 1) : qty + 1)} className="w-8 h-8 rounded-md bg-slate-700 text-slate-200 text-sm">＋</button>
                      {o.unitLabel && <span className="text-[10px] text-slate-500">{o.unitLabel}</span>}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          <p className="text-[10px] text-slate-600">上書きした値が親で各オプションの単価として使われます（割引ではありません）。</p>
        </div>
      )}

      {/* 追加/更新（コールバック契約のみ）*/}
      <div className="mt-5">
        <button
          type="button"
          onClick={onAddOrUpdate}
          disabled={selectedOptions.length === 0}
          className="text-xs font-medium text-blue-400 border border-blue-500/30 bg-blue-500/5 hover:bg-blue-500/10 disabled:opacity-40 px-4 min-h-[44px] rounded-lg transition-colors"
        >
          明細に追加 / 更新
        </button>
        <p className="text-[10px] text-slate-600 mt-2">
          価格計算・割引・明細生成は親（既存ロジック）が担当します。本コンポーネントは選択と入力のみを扱います。
        </p>
      </div>
    </div>
  );
}
