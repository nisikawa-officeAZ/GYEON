"use client";

import { useState, useMemo, useTransition } from "react";
import { updateShipmentStatus } from "@/lib/admin/logistics/get-logistics-shipments";
import type { LogisticsShipmentRow, ShipmentStatus } from "@/lib/admin/logistics/logistics-types";
import {
  SHIPMENT_STATUS_LABELS,
  SHIPMENT_STATUS_COLORS,
} from "@/lib/admin/logistics/logistics-types";

const STATUS_ORDER: ShipmentStatus[] = ["ready", "picking", "packed", "shipped", "completed"];

type Props = { initialShipments: LogisticsShipmentRow[] };

export default function LogisticsShipmentsClient({ initialShipments }: Props) {
  const [shipments, setShipments]     = useState(initialShipments);
  const [activeTab, setActiveTab]     = useState<ShipmentStatus | "all">("all");
  const [search, setSearch]           = useState("");
  const [error, setError]             = useState<string | null>(null);
  const [isPending, startTransition]  = useTransition();

  const counts = useMemo(() => {
    const map: Partial<Record<ShipmentStatus, number>> = {};
    for (const s of shipments) {
      map[s.status] = (map[s.status] ?? 0) + 1;
    }
    return map;
  }, [shipments]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return shipments.filter((s) => {
      if (activeTab !== "all" && s.status !== activeTab) return false;
      if (q &&
        !s.dealer_name.toLowerCase().includes(q) &&
        !(s.order_number ?? "").toLowerCase().includes(q) &&
        !(s.tracking_number ?? "").toLowerCase().includes(q)
      ) return false;
      return true;
    });
  }, [shipments, activeTab, search]);

  function advanceStatus(shipment: LogisticsShipmentRow) {
    const idx  = STATUS_ORDER.indexOf(shipment.status);
    const next = idx < STATUS_ORDER.length - 1 ? STATUS_ORDER[idx + 1] : null;
    if (!next) return;

    setError(null);
    startTransition(async () => {
      const result = await updateShipmentStatus(shipment.id, next);
      if (!result.success) {
        setError(result.error ?? "ステータス更新に失敗しました");
        return;
      }
      setShipments((prev) =>
        prev.map((s) => s.id === shipment.id
          ? { ...s, status: next, [`${next}_at`]: new Date().toISOString() }
          : s
        )
      );
    });
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-white">Shipment Queue</h1>
        <p className="text-sm text-slate-400 mt-0.5">{shipments.length} total shipments</p>
      </div>

      {/* Status tabs */}
      <div className="flex gap-2 mb-5 flex-wrap">
        <button
          onClick={() => setActiveTab("all")}
          className={[
            "px-4 py-1.5 rounded-lg text-sm font-medium transition-colors",
            activeTab === "all" ? "bg-slate-600 text-white" : "bg-slate-800 text-slate-400 hover:text-white",
          ].join(" ")}
        >
          All ({shipments.length})
        </button>
        {STATUS_ORDER.map((s) => (
          <button
            key={s}
            onClick={() => setActiveTab(s)}
            className={[
              "px-4 py-1.5 rounded-lg text-sm font-medium transition-colors",
              activeTab === s ? "bg-slate-600 text-white" : "bg-slate-800 text-slate-400 hover:text-white",
            ].join(" ")}
          >
            {SHIPMENT_STATUS_LABELS[s]} ({counts[s] ?? 0})
          </button>
        ))}

        <input
          type="text"
          placeholder="Search dealer / order…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="ml-auto bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white placeholder-slate-500 w-52"
        />
      </div>

      {error && (
        <p className="mb-4 text-sm text-red-400">{error}</p>
      )}

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-sm text-slate-500">
          {initialShipments.length === 0
            ? "No shipments. Create shipments from approved product orders."
            : "No results match the current filters."}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700/50">
                {["Status", "Dealer", "Order #", "Tracking", "Carrier", "Assigned To", "Created", "Action"].map((h) => (
                  <th key={h} className="text-left px-3 py-2.5 text-xs font-medium text-slate-400 uppercase whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const idx  = STATUS_ORDER.indexOf(r.status);
                const next = idx < STATUS_ORDER.length - 1 ? STATUS_ORDER[idx + 1] : null;

                return (
                  <tr key={r.id} className="border-b border-slate-700/20 hover:bg-slate-800/30">
                    <td className="px-3 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${SHIPMENT_STATUS_COLORS[r.status]}`}>
                        {SHIPMENT_STATUS_LABELS[r.status]}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-slate-300 whitespace-nowrap">{r.dealer_name}</td>
                    <td className="px-3 py-3 text-slate-400 font-mono text-xs">
                      {r.order_number ?? <span className="text-slate-600">—</span>}
                    </td>
                    <td className="px-3 py-3 text-slate-400 text-xs font-mono">
                      {r.tracking_number ?? <span className="text-slate-600">—</span>}
                    </td>
                    <td className="px-3 py-3 text-slate-400 text-xs">
                      {r.carrier ?? <span className="text-slate-600">—</span>}
                    </td>
                    <td className="px-3 py-3 text-slate-400 text-xs">
                      {r.assigned_name ?? <span className="text-slate-600">—</span>}
                    </td>
                    <td className="px-3 py-3 text-slate-500 text-xs whitespace-nowrap">
                      {new Date(r.created_at).toLocaleDateString("ja-JP")}
                    </td>
                    <td className="px-3 py-3">
                      {next ? (
                        <button
                          onClick={() => advanceStatus(r)}
                          disabled={isPending}
                          className="text-xs px-3 py-1 bg-blue-900/40 text-blue-300 border border-blue-700/50 rounded-lg hover:bg-blue-800/40 disabled:opacity-50 transition-colors whitespace-nowrap"
                        >
                          → {SHIPMENT_STATUS_LABELS[next]}
                        </button>
                      ) : (
                        <span className="text-xs text-slate-600">Done</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
