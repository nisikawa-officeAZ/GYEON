"use client";

import { useState } from "react";
import type { AdminStockMovementRow } from "@/lib/admin/logistics/logistics-types";

const MOVEMENT_TYPE_LABELS: Record<string, string> = {
  receive:          "入荷",
  adjustment_in:    "在庫増加",
  adjustment_out:   "在庫減少",
  sale:             "販売",
  return:           "返品",
  damage:           "破損",
  transfer:         "移動",
};

const MOVEMENT_TYPE_COLORS: Record<string, string> = {
  receive:          "bg-emerald-900/40 text-emerald-300",
  adjustment_in:    "bg-blue-900/40 text-blue-300",
  adjustment_out:   "bg-rose-900/40 text-rose-300",
  sale:             "bg-violet-900/40 text-violet-300",
  return:           "bg-amber-900/40 text-amber-300",
  damage:           "bg-red-900/40 text-red-300",
  transfer:         "bg-slate-700 text-slate-300",
};

type Props = { movements: AdminStockMovementRow[] };

export default function MovementsClient({ movements }: Props) {
  const [search,  setSearch]  = useState("");
  const [typeFilter, setTypeFilter] = useState("all");

  const movementTypes = Array.from(new Set(movements.map((m) => m.movement_type)));

  const filtered = movements.filter((m) => {
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      m.product_name.toLowerCase().includes(q) ||
      m.sku.toLowerCase().includes(q) ||
      m.dealer_name.toLowerCase().includes(q) ||
      (m.note && m.note.toLowerCase().includes(q));
    const matchType = typeFilter === "all" || m.movement_type === typeFilter;
    return matchSearch && matchType;
  });

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-white">Stock Movement History</h1>
          <p className="text-sm text-slate-400 mt-0.5">全ディーラー・全商品の在庫変動ログ</p>
        </div>
        <div className="text-sm text-slate-400">{filtered.length} 件表示</div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="商品名・SKU・ディーラー・メモ検索"
          className="flex-1 min-w-56 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-100 placeholder:text-slate-500 outline-none focus:border-green-500"
        />
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-100 outline-none focus:border-green-500"
        >
          <option value="all">All Types</option>
          {movementTypes.map((t) => (
            <option key={t} value={t}>{MOVEMENT_TYPE_LABELS[t] ?? t}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-500 text-sm">
          {movements.length === 0 ? "まだ在庫移動記録がありません。" : "検索条件に一致する記録がありません。"}
        </div>
      ) : (
        <div className="overflow-x-auto bg-slate-800/40 border border-slate-700/50 rounded-xl">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700/50">
                {["日時", "ディーラー", "商品", "種別", "変動", "調整後残", "理由/メモ", "担当者"].map((h) => (
                  <th key={h} className="text-left px-3 py-3 text-xs font-medium text-slate-400">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((m) => (
                <tr key={m.id} className="border-b border-slate-700/20 hover:bg-slate-800/30">
                  <td className="px-3 py-3 text-slate-400 text-xs whitespace-nowrap">
                    {new Date(m.created_at).toLocaleString("ja-JP", { dateStyle: "short", timeStyle: "short" })}
                  </td>
                  <td className="px-3 py-3 text-white text-xs">{m.dealer_name}</td>
                  <td className="px-3 py-3">
                    <div className="text-white text-xs">{m.product_name}</div>
                    <div className="text-slate-500 text-xs">{m.sku}</div>
                  </td>
                  <td className="px-3 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${MOVEMENT_TYPE_COLORS[m.movement_type] ?? "bg-slate-700 text-slate-300"}`}>
                      {MOVEMENT_TYPE_LABELS[m.movement_type] ?? m.movement_type}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-center font-medium">
                    <span className={m.quantity_delta >= 0 ? "text-emerald-400" : "text-rose-400"}>
                      {m.quantity_delta >= 0 ? "+" : ""}{m.quantity_delta}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-slate-300 text-center text-xs">{m.balance_after}</td>
                  <td className="px-3 py-3 text-slate-400 text-xs max-w-xs">
                    {m.adjustment_reason && (
                      <div className="text-rose-300 text-xs mb-0.5">{m.adjustment_reason}</div>
                    )}
                    {m.note && <div className="truncate">{m.note}</div>}
                    {!m.adjustment_reason && !m.note && <span className="text-slate-600">—</span>}
                  </td>
                  <td className="px-3 py-3 text-slate-500 text-xs">{m.created_by_name ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
