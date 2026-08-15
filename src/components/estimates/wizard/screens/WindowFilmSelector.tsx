"use client";

// Estimate Wizard Ver2.2 — Window Film section (Phase 4C, presentation-only).
//
// Flow: 施工部位を選択（複数）→ フィルム種類を選択 → 店舗設定由来の既定単価を表示 →
// 単価の上書き（任意）→ 追加/更新（コールバック）. All visual buttons (no pull-down).
// Areas, film types (brand/VLT/heat/color/price/disabled), enabled/order and disabled
// states arrive through PROPS (store-configurable, supports custom brands). The component
// computes NO price, applies NO discount, creates NO estimate items. The editable unit
// price is a field with a default value the owner uses later (not a discount/modifier).

import { SelectButton } from "../foundation/SelectButton";
import { formatYen } from "../foundation/tokens";
import type { WindowFilmSelectorProps } from "./step-types";

const CARD = "bg-[#1e293b] rounded-xl shadow-lg p-5";
const SECHDR = "text-xs font-semibold text-slate-400 uppercase tracking-wider";

export function WindowFilmSelector(props: WindowFilmSelectorProps) {
  const {
    shopRank, windowLocked, lockReason,
    areas, selectedAreaIds, onAreaToggle,
    filmTypes, selectedFilmTypeId, onFilmTypeChange,
    displayedUnitPrice, editableUnitPrice, onUnitPriceChange, onAddOrUpdate,
  } = props;

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

        {/* 3) 既定単価表示 + 編集可能単価（計算は親）*/}
        <div className="rounded-lg border border-slate-700/60 p-3 flex flex-col gap-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">店舗設定 単価（既定）</span>
            <span className="text-slate-200 tabular-nums">{displayedUnitPrice != null ? formatYen(displayedUnitPrice) : "—"}</span>
          </div>
          {onUnitPriceChange && (
            <label className="text-xs text-slate-400">
              単価を上書き（任意・この値が親で単価として使われます）
              <input
                type="number"
                inputMode="numeric"
                value={editableUnitPrice ?? ""}
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
            disabled={!hasArea || !selectedFilmTypeId}
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
