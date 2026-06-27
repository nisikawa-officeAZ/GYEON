"use client";

import { useState, useMemo } from "react";
import type { LogisticsBackorderRow } from "@/lib/admin/logistics/logistics-types";

const STATUS_LABELS: Record<string, string> = {
  waiting:   "Waiting",
  partial:   "Partial",
  fulfilled: "Fulfilled",
  cancelled: "Cancelled",
};

const STATUS_COLORS: Record<string, string> = {
  waiting:   "bg-amber-900/40 text-amber-300 border border-amber-700/50",
  partial:   "bg-blue-900/40  text-blue-300  border border-blue-700/50",
  fulfilled: "bg-green-900/40 text-green-300 border border-green-700/50",
  cancelled: "bg-slate-700/40 text-slate-400",
};

type Props = { initialBackorders: LogisticsBackorderRow[] };

export default function LogisticsBackordersClient({ initialBackorders }: Props) {
  const [filter, setFilter] = useState<"all" | "waiting" | "partial">("all");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return initialBackorders.filter((r) => {
      if (filter !== "all" && r.status !== filter) return false;
      if (q &&
        !r.dealer_name.toLowerCase().includes(q) &&
        !(r.product_name ?? "").toLowerCase().includes(q) &&
        !(r.order_number ?? "").toLowerCase().includes(q)
      ) return false;
      return true;
    });
  }, [initialBackorders, filter, search]);

  const waitingCount  = initialBackorders.filter((r) => r.status === "waiting").length;
  const partialCount  = initialBackorders.filter((r) => r.status === "partial").length;

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-white">Backorder Center</h1>
        <p className="text-sm text-slate-400 mt-0.5">
          {waitingCount} waiting · {partialCount} partial
        </p>
      </div>

      <div className="flex flex-wrap gap-3 mb-5">
        {(["all", "waiting", "partial"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={[
              "px-4 py-1.5 rounded-lg text-sm font-medium transition-colors",
              filter === s
                ? "bg-slate-600 text-white"
                : "bg-slate-800 text-slate-400 hover:text-white",
            ].join(" ")}
          >
            {s === "all" ? "All" : STATUS_LABELS[s]}
          </button>
        ))}

        <input
          type="text"
          placeholder="Search…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="ml-auto bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white placeholder-slate-500 w-52"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-sm text-slate-500">
          {initialBackorders.length === 0
            ? "No backorders. Create backorder records from the shipment queue or via admin actions."
            : "No results match the current filters."}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700/50">
                {["Status", "Dealer", "Product", "Order #", "Ordered", "Waiting", "Expected", "Target Delivery"].map((h) => (
                  <th key={h} className="text-left px-3 py-2.5 text-xs font-medium text-slate-400 uppercase whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-b border-slate-700/20 hover:bg-slate-800/30">
                  <td className="px-3 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[r.status]}`}>
                      {STATUS_LABELS[r.status]}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-slate-300 whitespace-nowrap">{r.dealer_name}</td>
                  <td className="px-3 py-3">
                    <div className="text-white">{r.product_name ?? "—"}</div>
                    {r.sku && <div className="text-xs text-slate-500">{r.sku}</div>}
                  </td>
                  <td className="px-3 py-3 text-slate-400 font-mono text-xs">{r.order_number ?? "—"}</td>
                  <td className="px-3 py-3 text-slate-300 text-center">{r.ordered_qty}</td>
                  <td className="px-3 py-3 text-amber-400 font-semibold text-center">{r.waiting_qty}</td>
                  <td className="px-3 py-3 text-slate-400 text-xs whitespace-nowrap">
                    {r.expected_arrival_date
                      ? new Date(r.expected_arrival_date).toLocaleDateString("ja-JP")
                      : <span className="text-slate-600">—</span>}
                  </td>
                  <td className="px-3 py-3 text-slate-400 text-xs whitespace-nowrap">
                    {r.target_delivery_date
                      ? new Date(r.target_delivery_date).toLocaleDateString("ja-JP")
                      : <span className="text-slate-600">—</span>}
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
