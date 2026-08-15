"use client";

// Estimate Wizard Ver2.2 — Car Wash section (Phase 4E, presentation-only).
//
// Flow: 洗車メニュー選択（単一）→ 供給された単価を表示 → 親が editable とした場合のみ単価
// 上書き → 追加/更新（コールバック）. Visual cards only (no pull-down). Menus, prices,
// disabled states arrive through PROPS (store-configurable). The Estimate UI shows only
// name / description / price / selected / disabled — `estimatedDurationMinutes` from the
// data contract is intentionally NOT rendered (kept for future reservation workload). No
// price calculation, no estimate items.

import { formatYen, cn } from "../foundation/tokens";
import type { CarWashSelectorProps, WashMenu } from "./step-types";

const CARD = "bg-[#1e293b] rounded-xl shadow-lg p-5";
const SECHDR = "text-xs font-semibold text-slate-400 uppercase tracking-wider";

function MenuCard({ menu, selected, onSelect }: { menu: WashMenu; selected: boolean; onSelect: () => void }) {
  const disabled = !!menu.disabled;
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={disabled ? undefined : onSelect}
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
        <span className={cn("text-sm font-medium truncate", disabled ? "text-slate-600" : "text-slate-100")}>{menu.name}</span>
        <div className="flex items-center gap-1.5 shrink-0">
          {menu.badge && !disabled && (
            <span className="text-[9px] text-emerald-300 border border-emerald-600/40 rounded px-1 py-0.5">{menu.badge}</span>
          )}
          {selected && !disabled && <span aria-hidden className="text-blue-300 text-xs">✓</span>}
        </div>
      </div>
      {menu.description && <span className="text-[11px] text-slate-500 truncate">{menu.description}</span>}
      <span className={cn("text-sm tabular-nums", disabled ? "text-slate-600" : "text-slate-200")}>{formatYen(menu.defaultPrice)}</span>
      {disabled && menu.disabledReason && <span className="text-[10px] text-slate-500">（{menu.disabledReason}）</span>}
    </button>
  );
}

export function CarWashSelector(props: CarWashSelectorProps) {
  const {
    washMenus, selectedWashMenuId, onWashMenuChange,
    displayedUnitPrice, editablePriceAllowed, editableUnitPrice, onUnitPriceChange,
    informationalMessage, onAddOrUpdate,
  } = props;

  const menus = [...washMenus].sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));
  const selected = selectedWashMenuId;

  return (
    <div className={CARD}>
      <h3 className={SECHDR}>洗車</h3>
      <p className="text-[11px] text-slate-500 mt-1 mb-3">店舗設定の洗車メニューから選択します（単一選択）。</p>

      {informationalMessage && (
        <div className="rounded-lg border border-slate-700/60 bg-slate-800/40 p-2.5 mb-3">
          <p className="text-[11px] text-slate-300">{informationalMessage}</p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {menus.length === 0 && <p className="text-[11px] text-slate-500">店舗設定で洗車メニューを登録してください。</p>}
        {menus.map((m) => (
          <MenuCard key={m.id} menu={m} selected={selected === m.id} onSelect={() => onWashMenuChange(m.id)} />
        ))}
      </div>

      {selected && (
        <div className="rounded-lg border border-slate-700/60 p-3 mt-4 flex flex-col gap-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">単価（既定）</span>
            <span className="text-slate-200 tabular-nums">{displayedUnitPrice != null ? formatYen(displayedUnitPrice) : "—"}</span>
          </div>
          {editablePriceAllowed && onUnitPriceChange && (
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
      )}

      <div className="mt-5">
        <button
          type="button"
          onClick={onAddOrUpdate}
          disabled={!selected}
          className="text-xs font-medium text-blue-400 border border-blue-500/30 bg-blue-500/5 hover:bg-blue-500/10 disabled:opacity-40 px-4 min-h-[44px] rounded-lg transition-colors"
        >
          明細に追加 / 更新
        </button>
        <p className="text-[10px] text-slate-600 mt-2">
          価格計算・明細生成は親（既存ロジック）が担当します。想定必要時間は見積 UI に表示せず、将来のカレンダー計算用に保持されます。
        </p>
      </div>
    </div>
  );
}
