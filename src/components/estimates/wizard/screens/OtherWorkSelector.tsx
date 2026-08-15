"use client";

// Estimate Wizard Ver2.2 — Other Work section (Phase 4G, presentation-only).
//
// Two sources: (1) store-configured PRESET items — multi-select visual cards with editable
// unit price / quantity where the item allows; (2) fully MANUAL custom rows — free text /
// number inputs (name / description / unit price / quantity / unit label) with add / edit /
// delete and multiple rows. Visual buttons/cards only (no pull-down). All data + callbacks
// arrive through PROPS. The component performs NO total/subtotal calculation, creates NO
// estimate items, and never touches DB/inventory/calendar. `estimatedDurationMinutes` from
// the data contract is NOT displayed here (kept for future workload calculation).

import { formatYen, cn } from "../foundation/tokens";
import type { OtherWorkSelectorProps, OtherWorkPresetItem } from "./step-types";

const CARD = "bg-[#1e293b] rounded-xl shadow-lg p-5";
const SECHDR = "text-xs font-semibold text-slate-400 uppercase tracking-wider";
const INPUT =
  "bg-[#0f172a] border border-slate-700 rounded-lg px-3 py-2.5 text-base sm:text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-[#1d4ed8] transition-colors";

function PresetCard({ item, selected, onToggle }: { item: OtherWorkPresetItem; selected: boolean; onToggle: () => void }) {
  const disabled = !!item.disabled;
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
        <span className={cn("text-sm font-medium truncate", disabled ? "text-slate-600" : "text-slate-100")}>{item.name}</span>
        <div className="flex items-center gap-1.5 shrink-0">
          {item.badge && !disabled && <span className="text-[9px] text-emerald-300 border border-emerald-600/40 rounded px-1 py-0.5">{item.badge}</span>}
          {selected && !disabled && <span aria-hidden className="text-blue-300 text-xs">✓</span>}
        </div>
      </div>
      {item.description && <span className="text-[11px] text-slate-500 truncate">{item.description}</span>}
      <span className={cn("text-sm tabular-nums", disabled ? "text-slate-600" : "text-slate-200")}>{formatYen(item.defaultPrice)}</span>
      {disabled && item.disabledReason && <span className="text-[10px] text-slate-500">（{item.disabledReason}）</span>}
    </button>
  );
}

export function OtherWorkSelector(props: OtherWorkSelectorProps) {
  const {
    presetOtherWorkItems, selectedPresetItemIds, onPresetItemToggle,
    unitPricesByItem, onUnitPriceChange, quantitiesByItem, onQuantityChange,
    customRows, onCustomRowAdd, onCustomRowUpdate, onCustomRowDelete,
    informationalMessage, onAddOrUpdate,
  } = props;

  const presets = [...presetOtherWorkItems].sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));
  const selectedPresets = presets.filter((p) => selectedPresetItemIds.includes(p.id));

  return (
    <div className={CARD}>
      <h3 className={SECHDR}>その他の作業</h3>
      <p className="text-[11px] text-slate-500 mt-1 mb-3">プリセット項目の選択、または手入力で自由に作業を追加できます。</p>

      {informationalMessage && (
        <div className="rounded-lg border border-slate-700/60 bg-slate-800/40 p-2.5 mb-3">
          <p className="text-[11px] text-slate-300">{informationalMessage}</p>
        </div>
      )}

      {/* 1) プリセット項目（複数選択・カード）*/}
      {presets.length > 0 && (
        <div className="mb-5">
          <span className="text-xs font-medium text-slate-300">プリセット項目（複数選択可）</span>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 mt-2">
            {presets.map((p) => (
              <PresetCard key={p.id} item={p} selected={selectedPresetItemIds.includes(p.id)} onToggle={() => onPresetItemToggle(p.id)} />
            ))}
          </div>

          {/* 選択プリセットの単価・数量（許可時のみ）*/}
          {selectedPresets.length > 0 && (
            <div className="rounded-lg border border-slate-700/60 p-3 mt-3 flex flex-col gap-2">
              <span className="text-[11px] text-slate-400">選択中プリセットの単価・数量</span>
              {selectedPresets.map((p) => {
                const qty = quantitiesByItem[p.id] ?? p.minQty ?? 1;
                return (
                  <div key={p.id} className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs text-slate-300 truncate">{p.name}</span>
                    <div className="flex items-center gap-2">
                      {p.editableUnitPrice ? (
                        <input
                          type="number"
                          inputMode="numeric"
                          value={unitPricesByItem[p.id] ?? ""}
                          onChange={(e) => onUnitPriceChange(p.id, e.target.value)}
                          placeholder={String(p.defaultPrice)}
                          className={`${INPUT} w-28 text-right`}
                        />
                      ) : (
                        <span className="text-sm text-slate-200 tabular-nums">{formatYen(p.defaultPrice)}</span>
                      )}
                      {p.quantityRequired && (
                        <div className="flex items-center gap-1">
                          <button type="button" onClick={() => onQuantityChange(p.id, Math.max(p.minQty ?? 1, qty - 1))} className="w-8 h-8 rounded-md bg-slate-700 text-slate-200 text-sm">−</button>
                          <span className="w-7 text-center text-sm text-slate-100 tabular-nums">{qty}</span>
                          <button type="button" onClick={() => onQuantityChange(p.id, p.maxQty ? Math.min(p.maxQty, qty + 1) : qty + 1)} className="w-8 h-8 rounded-md bg-slate-700 text-slate-200 text-sm">＋</button>
                          {p.unitLabel && <span className="text-[10px] text-slate-500">{p.unitLabel}</span>}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 2) 手入力カスタム行 */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-slate-300">手入力（プリセット外の作業）</span>
          <button
            type="button"
            onClick={onCustomRowAdd}
            className="text-xs text-blue-400 border border-blue-500/30 bg-blue-500/5 hover:bg-blue-500/10 px-3 min-h-[36px] rounded-lg transition-colors"
          >
            ＋ 行を追加
          </button>
        </div>

        {customRows.length === 0 && (
          <p className="text-[11px] text-slate-500">「＋ 行を追加」で作業名・金額・数量を自由に入力できます。</p>
        )}

        <div className="flex flex-col gap-2">
          {customRows.map((row) => (
            <div key={row.id} className="rounded-lg border border-slate-700/40 p-2.5 flex flex-col gap-2">
              <div className="flex flex-col sm:flex-row gap-2">
                <input type="text" value={row.name} onChange={(e) => onCustomRowUpdate(row.id, { name: e.target.value })} placeholder="作業名" className={`${INPUT} flex-1`} />
                <input type="text" value={row.description} onChange={(e) => onCustomRowUpdate(row.id, { description: e.target.value })} placeholder="説明（任意）" className={`${INPUT} flex-1`} />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <input type="number" inputMode="numeric" value={row.unitPrice} onChange={(e) => onCustomRowUpdate(row.id, { unitPrice: e.target.value })} placeholder="単価" className={`${INPUT} w-28 text-right`} />
                <span className="text-slate-600 text-xs">×</span>
                <input type="number" inputMode="numeric" value={row.quantity} onChange={(e) => onCustomRowUpdate(row.id, { quantity: e.target.value })} placeholder="数量" className={`${INPUT} w-20 text-right`} />
                <input type="text" value={row.unitLabel} onChange={(e) => onCustomRowUpdate(row.id, { unitLabel: e.target.value })} placeholder="単位（任意）" className={`${INPUT} w-24`} />
                <button type="button" onClick={() => onCustomRowDelete(row.id)} aria-label="行を削除" className="ml-auto shrink-0 min-h-[44px] px-3 rounded-lg text-slate-500 hover:text-red-400 border border-slate-700">✕</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 追加/更新（コールバック契約のみ）*/}
      <div className="mt-5">
        <button
          type="button"
          onClick={onAddOrUpdate}
          disabled={selectedPresets.length === 0 && customRows.length === 0}
          className="text-xs font-medium text-blue-400 border border-blue-500/30 bg-blue-500/5 hover:bg-blue-500/10 disabled:opacity-40 px-4 min-h-[44px] rounded-lg transition-colors"
        >
          明細に追加 / 更新
        </button>
        <p className="text-[10px] text-slate-600 mt-2">
          小計・合計計算・明細生成は親（既存ロジック）が担当します。本コンポーネントは入力のみを扱います。
        </p>
      </div>
    </div>
  );
}
