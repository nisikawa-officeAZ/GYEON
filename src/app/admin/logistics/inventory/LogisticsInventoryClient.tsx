"use client";

import { useState, useMemo } from "react";
import type { LogisticsInventoryRow } from "@/lib/admin/logistics/logistics-types";

type Props = { initialInventory: LogisticsInventoryRow[] };

export default function LogisticsInventoryClient({ initialInventory }: Props) {
  const [search, setSearch]       = useState("");
  const [dealer, setDealer]       = useState("");
  const [category, setCategory]   = useState("");
  const [zeroOnly, setZeroOnly]   = useState(false);

  const dealers    = useMemo(() => [...new Set(initialInventory.map((r) => r.dealer_name))].sort(), [initialInventory]);
  const categories = useMemo(() => [...new Set(initialInventory.map((r) => r.category ?? "—"))].sort(), [initialInventory]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return initialInventory.filter((r) => {
      if (dealer   && r.dealer_name !== dealer)                         return false;
      if (category && (r.category ?? "—") !== category)               return false;
      if (zeroOnly && r.total_quantity > 0)                            return false;
      if (q && !r.product_name.toLowerCase().includes(q)
           && !r.sku.toLowerCase().includes(q)
           && !r.dealer_name.toLowerCase().includes(q))               return false;
      return true;
    });
  }, [initialInventory, search, dealer, category, zeroOnly]);

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">Inventory Overview</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            {filtered.length} records
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <input
          type="text"
          placeholder="Search product or dealer…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white placeholder-slate-500 w-64"
        />

        <select
          value={dealer}
          onChange={(e) => setDealer(e.target.value)}
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white"
        >
          <option value="">All Dealers</option>
          {dealers.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>

        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white"
        >
          <option value="">All Categories</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>

        <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
          <input
            type="checkbox"
            checked={zeroOnly}
            onChange={(e) => setZeroOnly(e.target.checked)}
            className="accent-red-500"
          />
          Zero stock only
        </label>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-500 text-sm">
          {initialInventory.length === 0
            ? "No inventory data. Apply migration 069 and dealers must count their stock."
            : "No results match the current filters."}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700/50">
                {["Dealer", "SKU", "Product", "Category", "Boxes", "Loose", "Total", "Reserved", "Available", "Last Counted"].map((h) => (
                  <th key={h} className="text-left px-3 py-2.5 text-xs font-medium text-slate-400 uppercase whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => (
                <tr
                  key={`${r.dealer_id}-${r.product_id}`}
                  className={[
                    "border-b border-slate-700/20",
                    r.total_quantity === 0 ? "bg-red-900/5" : "",
                    "hover:bg-slate-800/30",
                  ].join(" ")}
                >
                  <td className="px-3 py-3 text-slate-300 whitespace-nowrap">{r.dealer_name}</td>
                  <td className="px-3 py-3 text-slate-500 font-mono text-xs whitespace-nowrap">{r.sku}</td>
                  <td className="px-3 py-3 text-white whitespace-nowrap">{r.product_name}</td>
                  <td className="px-3 py-3 text-slate-400 text-xs">{r.category ?? "—"}</td>
                  <td className="px-3 py-3 text-slate-300 text-center">{r.case_count}</td>
                  <td className="px-3 py-3 text-slate-300 text-center">{r.loose_count}</td>
                  <td className={`px-3 py-3 font-semibold text-center ${r.total_quantity === 0 ? "text-red-400" : "text-white"}`}>
                    {r.total_quantity}
                  </td>
                  <td className="px-3 py-3 text-amber-400 text-center">{r.reserved_qty > 0 ? r.reserved_qty : <span className="text-slate-600">—</span>}</td>
                  <td className={`px-3 py-3 font-medium text-center ${r.available_qty === 0 ? "text-red-400" : "text-emerald-400"}`}>
                    {r.available_qty}
                  </td>
                  <td className="px-3 py-3 text-slate-500 text-xs whitespace-nowrap">
                    {new Date(r.last_counted_at).toLocaleDateString("ja-JP")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
