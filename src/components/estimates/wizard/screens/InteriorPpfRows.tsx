"use client";

// Estimate Wizard Ver2.2 — Interior PPF free-entry rows (Phase 4B, presentation-only).
//
// Interior PPF locations vary by shop/vehicle, so this is free entry: 施工箇所(text) +
// 金額(text) per row, with add / edit / delete and multiple rows. Existing estimates can
// preload rows. NO pricing calculation, NO estimate-item creation — everything is reported
// via callbacks; the amount is a raw string the owner interprets later.

import type { InteriorPpfRow } from "./step-types";

export function InteriorPpfRows({
  rows,
  onAdd,
  onUpdate,
  onDelete,
}: {
  rows: InteriorPpfRow[];
  onAdd: () => void;
  onUpdate: (id: string, patch: Partial<InteriorPpfRow>) => void;
  onDelete: (id: string) => void;
}) {
  const inputCls =
    "bg-[#0f172a] border border-slate-700 rounded-lg px-3 py-2.5 text-base sm:text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-[#1d4ed8] transition-colors";

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-slate-300">室内PPF施工（施工箇所・金額を手入力）</span>
        <button
          type="button"
          onClick={onAdd}
          className="text-xs text-blue-400 border border-blue-500/30 bg-blue-500/5 hover:bg-blue-500/10 px-3 min-h-[36px] rounded-lg transition-colors"
        >
          ＋ 行を追加
        </button>
      </div>

      {rows.length === 0 && (
        <p className="text-[11px] text-slate-500">「＋ 行を追加」で施工箇所と金額を登録できます（例：ナビゲーション・メーターパネル・ウッドパネル部 ¥46,000）。</p>
      )}

      <div className="flex flex-col gap-2">
        {rows.map((row) => (
          <div key={row.id} className="flex flex-col sm:flex-row gap-2 items-stretch">
            <input
              type="text"
              value={row.location}
              onChange={(e) => onUpdate(row.id, { location: e.target.value })}
              placeholder="施工箇所（例：ナビ・メーターパネル）"
              className={`${inputCls} flex-1`}
            />
            <input
              type="number"
              inputMode="numeric"
              value={row.amount}
              onChange={(e) => onUpdate(row.id, { amount: e.target.value })}
              placeholder="金額"
              className={`${inputCls} sm:w-32 text-right`}
            />
            <button
              type="button"
              onClick={() => onDelete(row.id)}
              aria-label="行を削除"
              className="shrink-0 min-h-[44px] px-3 rounded-lg text-slate-500 hover:text-red-400 border border-slate-700"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
