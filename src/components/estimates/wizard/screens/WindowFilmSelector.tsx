"use client";

// Estimate Wizard Ver2.2 — Window Film section (Phase 4C, presentation-only).
//
// Flow: 施工部位を選択（複数）→ フィルム種類を選択 → 店舗設定由来の既定単価を表示 →
// 単価の上書き（任意）→ 追加/更新（コールバック）. All visual buttons (no pull-down).
// Areas, film types (brand/VLT/heat/color/price/disabled), enabled/order and disabled
// states arrive through PROPS (store-configurable, supports custom brands). The component
// computes NO price, applies NO discount, creates NO estimate items. The editable unit
// price is a field with a default value the owner uses later (not a discount/modifier).

import { useEffect, useRef } from "react";
import { SelectButton } from "../foundation/SelectButton";
import { formatYen } from "../foundation/tokens";
import type { WindowFilmSelectorProps } from "./step-types";
import { reconcileWindowFilmUnitPriceInput } from "./window-film-v1-suggested-price";

const CARD = "bg-[#1e293b] rounded-xl shadow-lg p-5";
const SECHDR = "text-xs font-semibold text-slate-400 uppercase tracking-wider";

export function WindowFilmSelector(props: WindowFilmSelectorProps) {
  const {
    shopRank, windowLocked, lockReason,
    areas, selectedAreaIds, onAreaToggle,
    filmTypes, selectedFilmTypeId, onFilmTypeChange,
    packages = [], selectedPackageCode = null, onPackageChange,
    options = [], selectedOptionIds = [], optionQuantities = {}, onOptionToggle, onOptionQuantityChange,
    displayedUnitPrice, editableUnitPrice, onUnitPriceChange, onAddOrUpdate,
  } = props;

  const editableInputRef = useRef(editableUnitPrice ?? "");
  const onUnitPriceChangeRef = useRef(onUnitPriceChange);
  const previousSuggestedInputRef = useRef<string | null>(null);
  editableInputRef.current = editableUnitPrice ?? "";
  onUnitPriceChangeRef.current = onUnitPriceChange;

  useEffect(() => {
    const nextSuggestedInput = displayedUnitPrice === null || displayedUnitPrice === undefined
      ? null
      : String(displayedUnitPrice);
    const nextInput = reconcileWindowFilmUnitPriceInput(
      editableInputRef.current,
      previousSuggestedInputRef.current,
      nextSuggestedInput,
    );
    previousSuggestedInputRef.current = nextSuggestedInput;
    if (nextInput !== null && nextInput !== editableInputRef.current) {
      onUnitPriceChangeRef.current?.(nextInput);
    }
  }, [displayedUnitPrice]);

  if (windowLocked) {
    return (
      <div className={CARD}>
        <h3 className={SECHDR}>ウィンドウフィルム</h3>
        <p className="text-xs text-slate-500 mt-3">
          {lockReason ?? `現在のショップランク（${shopRank}）ではウィンドウフィルムは選択できません。`}
        </p>
      </div>
    );
  }

  const hasArea = selectedAreaIds.length > 0;
  const hasScope = hasArea || selectedPackageCode !== null;
  const effectiveEditableUnitPrice = editableUnitPrice?.trim() !== ""
    ? editableUnitPrice
    : displayedUnitPrice != null ? String(displayedUnitPrice) : "";

  return (
    <div className={CARD}>
      <div className="flex items-center justify-between mb-4">
        <h3 className={SECHDR}>ウィンドウフィルム</h3>
        <span className="text-[10px] text-slate-500">ショップランク: {shopRank}</span>
      </div>

      <div className="flex flex-col gap-5">
        {/* 1) 施工部位（複数選択・ボタンのみ）*/}
        <div>
          <span className="text-xs font-medium text-slate-300">施工部位を選択（複数選択可）</span>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 mt-2">
            {areas.map((a) => (
              <SelectButton
                key={a.id}
                selected={selectedAreaIds.includes(a.id)}
                disabled={a.disabled}
                subLabel={a.disabled ? a.disabledReason : undefined}
                onSelect={() => onAreaToggle(a.id)}
              >
                {a.label}
              </SelectButton>
            ))}
          </div>
          {hasArea && <p className="text-[11px] text-slate-400 mt-2">選択中: {selectedAreaIds.length} 部位</p>}
        </div>

        {packages.length > 0 && (
          <div>
            <span className="text-xs font-medium text-slate-300">セットメニューを選択（部位選択とは併用不可）</span>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 mt-2">
              {packages.map((item) => <SelectButton key={item.id} selected={selectedPackageCode === item.id} onSelect={() => onPackageChange?.(selectedPackageCode === item.id ? null : item.id)} subLabel={`${formatYen(item.priceYen)}・${item.durationMinutes}分`}>{item.label}</SelectButton>)}
            </div>
          </div>
        )}

        {/* 2) フィルム種類（props 供給・ブランド/VLT/遮熱/色 表示）*/}
        <div>
          <span className="text-xs font-medium text-slate-300">フィルム種類を選択</span>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 mt-2">
            {filmTypes.length === 0 && <p className="text-[11px] text-slate-500">店舗設定でフィルム種類を登録してください。</p>}
            {filmTypes.map((f) => (
              <SelectButton
                key={f.id}
                selected={selectedFilmTypeId === f.id}
                disabled={f.disabled}
                subLabel={
                  f.disabled
                    ? f.disabledReason
                    : [f.brand && f.brand !== "GYEON" ? f.brand : null, f.vlt && `VLT ${f.vlt}`, f.heatRejection, f.color]
                        .filter(Boolean)
                        .join(" · ") || undefined
                }
                onSelect={() => onFilmTypeChange(f.id)}
              >
                {f.label}
              </SelectButton>
            ))}
          </div>
        </div>

        {options.length > 0 && (
          <div>
            <span className="text-xs font-medium text-slate-300">付帯オプション</span>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 mt-2">
              {options.map((item) => <div key={item.id} className="flex flex-col gap-2"><SelectButton selected={selectedOptionIds.includes(item.id)} onSelect={() => onOptionToggle?.(item.id)} subLabel={`${formatYen(item.priceYen)}・${item.durationMinutes}分`}>{item.label}</SelectButton>{selectedOptionIds.includes(item.id) && <input aria-label={`${item.label} 数量`} type="number" min={1} step={1} value={optionQuantities[item.id] ?? 1} onChange={(event) => onOptionQuantityChange?.(item.id, Math.max(1, Number.parseInt(event.target.value, 10) || 1))} className="w-full rounded-lg border border-slate-700 bg-[#0f172a] px-3 py-2 text-right text-sm text-slate-100"/>}</div>)}
            </div>
          </div>
        )}

        {/* 3) 既定単価表示 + 編集可能単価（計算は親）*/}
        <div className="rounded-lg border border-slate-700/60 p-3 flex flex-col gap-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">店舗設定 単価（既定）</span>
            <span className="text-slate-200 tabular-nums">{displayedUnitPrice != null ? formatYen(displayedUnitPrice) : "—"}</span>
          </div>
          {onUnitPriceChange && (
            <label className="text-xs text-slate-400">
              見積単価（自動計算・必要な場合のみ上書き）
              <input
                type="number"
                inputMode="numeric"
                value={effectiveEditableUnitPrice}
                onChange={(e) => onUnitPriceChange(e.target.value)}
                placeholder={displayedUnitPrice != null ? String(displayedUnitPrice) : "単価"}
                className="mt-1 w-full bg-[#0f172a] border border-slate-700 rounded-lg px-3 py-2.5 text-base sm:text-sm text-slate-100 text-right focus:outline-none focus:border-[#1d4ed8]"
              />
            </label>
          )}
        </div>

        {/* 4) 追加/更新（コールバック契約のみ）*/}
        <div>
          <button
            type="button"
            onClick={onAddOrUpdate}
            disabled={!hasScope || !selectedFilmTypeId}
            className="text-xs font-medium text-blue-400 border border-blue-500/30 bg-blue-500/5 hover:bg-blue-500/10 disabled:opacity-40 px-4 min-h-[44px] rounded-lg transition-colors"
          >
            明細に追加 / 更新
          </button>
          <p className="text-[10px] text-slate-600 mt-2">
            価格計算・明細生成は親（既存ロジック）が担当します。本コンポーネントは選択と単価入力のみを扱います。
          </p>
        </div>
      </div>
    </div>
  );
}
