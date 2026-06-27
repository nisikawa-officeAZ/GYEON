"use client";

import { useState, useTransition } from "react";
import { startPoFulfillment, recordLineReceiving } from "@/lib/admin/logistics/po-receiving-actions";
import type {
  PendingProductOrder,
  PoFulfillmentLine,
  ExtendedOrderStatus,
} from "@/lib/admin/logistics/logistics-types";

const STATUS_LABELS: Record<ExtendedOrderStatus, string> = {
  draft:      "下書き",
  submitted:  "注文済み",
  approved:   "承認済み",
  fulfilling: "出荷準備中",
  fulfilled:  "完了",
  cancelled:  "キャンセル",
};

const STATUS_COLORS: Record<ExtendedOrderStatus, string> = {
  draft:      "bg-slate-700 text-slate-300",
  submitted:  "bg-amber-900/40 text-amber-300",
  approved:   "bg-blue-900/40 text-blue-300",
  fulfilling: "bg-purple-900/40 text-purple-300",
  fulfilled:  "bg-emerald-900/40 text-emerald-300",
  cancelled:  "bg-slate-700 text-slate-500",
};

const LINE_STATUS_LABELS: Record<string, string> = {
  pending:     "未処理",
  partial:     "一部出荷",
  fulfilled:   "出荷完了",
  backordered: "バックオーダー",
};

type LineEditState = {
  [lineId: string]: {
    fulfilledQty:   number;
    backorderedQty: number;
    note:           string;
  };
};

type Props = { initialOrders: PendingProductOrder[] };

export default function PoReceivingClient({ initialOrders }: Props) {
  const [orders, setOrders]         = useState(initialOrders);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [lineEdits, setLineEdits]   = useState<LineEditState>({});
  const [isPending, startTransition] = useTransition();
  const [actionError, setActionError] = useState<string | null>(null);

  function initLineEdits(lines: PoFulfillmentLine[]) {
    const edits: LineEditState = {};
    for (const l of lines) {
      edits[l.id] = {
        fulfilledQty:   l.fulfilled_qty,
        backorderedQty: l.backordered_qty,
        note:           l.note ?? "",
      };
    }
    setLineEdits(edits);
  }

  function handleExpand(order: PendingProductOrder) {
    if (expandedId === order.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(order.id);
    if (order.lines.length > 0) initLineEdits(order.lines);
  }

  function handleStartFulfillment(orderId: string) {
    setActionError(null);
    startTransition(async () => {
      const result = await startPoFulfillment(orderId);
      if (!result.success) { setActionError(result.error); return; }

      setOrders((prev) => prev.map((o) =>
        o.id === orderId ? { ...o, status: "fulfilling" as ExtendedOrderStatus } : o
      ));
    });
  }

  function handleSaveLine(orderId: string, lineId: string) {
    const edit = lineEdits[lineId];
    if (!edit) return;

    setActionError(null);
    startTransition(async () => {
      const result = await recordLineReceiving({
        lineId,
        orderId,
        fulfilledQty:   edit.fulfilledQty,
        backorderedQty: edit.backorderedQty,
        note:           edit.note,
      });

      if (!result.success) { setActionError(result.error); return; }

      // Update local line state
      setOrders((prev) =>
        prev.map((o) => {
          if (o.id !== orderId) return o;
          const ordQty = o.lines.find((l) => l.id === lineId)?.ordered_qty ?? 0;
          const fulQ   = edit.fulfilledQty;
          const backQ  = edit.backorderedQty;
          const rem    = Math.max(0, ordQty - fulQ - backQ);
          let lineStatus: PoFulfillmentLine["status"];
          if (fulQ >= ordQty)            lineStatus = "fulfilled";
          else if (backQ >= ordQty - fulQ) lineStatus = "backordered";
          else if (fulQ > 0)             lineStatus = "partial";
          else                           lineStatus = "pending";

          const updatedLines = o.lines.map((l) =>
            l.id !== lineId ? l : {
              ...l,
              fulfilled_qty:   fulQ,
              backordered_qty: backQ,
              remaining_qty:   rem,
              status:          lineStatus,
              note:            edit.note || null,
            }
          );

          const allDone = updatedLines.every((l) => l.status === "fulfilled" || l.status === "backordered");
          return {
            ...o,
            lines:  updatedLines,
            status: (allDone ? "fulfilled" : "fulfilling") as ExtendedOrderStatus,
          };
        })
      );
    });
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-white">PO Receiving</h1>
        <p className="text-sm text-slate-400 mt-0.5">ディーラー注文の出荷準備・出荷数量の記録</p>
      </div>

      {actionError && (
        <div className="mb-4 px-4 py-3 bg-red-900/30 border border-red-700/50 rounded-lg text-sm text-red-300">
          {actionError}
        </div>
      )}

      {orders.length === 0 ? (
        <div className="text-center py-16 text-slate-500 text-sm">
          処理対象の注文がありません。
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => {
            const isExpanded = expandedId === order.id;
            const canStart   = order.status === "submitted" || order.status === "approved";
            const isFulfilling = order.status === "fulfilling";

            return (
              <div key={order.id} className="bg-slate-800/60 border border-slate-700/50 rounded-xl overflow-hidden">
                {/* Order header */}
                <div className="flex items-center gap-4 px-5 py-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-white font-medium text-sm">
                        {order.order_number ?? order.id.slice(0, 8).toUpperCase()}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[order.status]}`}>
                        {STATUS_LABELS[order.status]}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-400">
                      <span>{order.dealer_name}</span>
                      <span>|</span>
                      <span>{order.item_count} アイテム / 合計 {order.total_qty} 個</span>
                      <span>|</span>
                      <span>{new Date(order.created_at).toLocaleDateString("ja-JP")}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {canStart && (
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => handleStartFulfillment(order.id)}
                        className="px-3 py-1.5 bg-purple-700 hover:bg-purple-600 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-colors"
                      >
                        出荷準備開始
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleExpand(order)}
                      className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs rounded-lg transition-colors"
                    >
                      {isExpanded ? "▲ 閉じる" : "▼ 詳細"}
                    </button>
                  </div>
                </div>

                {/* Lines */}
                {isExpanded && (
                  <div className="border-t border-slate-700/50">
                    {order.lines.length === 0 ? (
                      <div className="px-5 py-4 text-sm text-slate-500">
                        {canStart
                          ? "「出荷準備開始」を押して明細を作成してください。"
                          : "明細データがありません。"}
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-700/30">
                        {order.lines.map((line) => {
                          const edit = lineEdits[line.id] ?? {
                            fulfilledQty:   line.fulfilled_qty,
                            backorderedQty: line.backordered_qty,
                            note:           line.note ?? "",
                          };
                          const isLineDone = line.status === "fulfilled" || line.status === "backordered";

                          return (
                            <div key={line.id} className="px-5 py-3 flex items-center gap-4 flex-wrap">
                              {/* Product info */}
                              <div className="flex-1 min-w-48">
                                <div className="text-sm text-white">{line.product_name_snapshot}</div>
                                <div className="text-xs text-slate-500 flex gap-2">
                                  <span>{line.sku_snapshot}</span>
                                  <span>注文: {line.ordered_qty} 個</span>
                                  <span className={`${line.status === "fulfilled" ? "text-emerald-400" : line.status === "partial" ? "text-amber-400" : "text-slate-500"}`}>
                                    {LINE_STATUS_LABELS[line.status]}
                                  </span>
                                </div>
                              </div>

                              {/* Fulfillment inputs */}
                              {isFulfilling && !isLineDone && (
                                <>
                                  <div className="flex items-center gap-2">
                                    <div>
                                      <label className="block text-xs text-slate-400 mb-1">出荷数</label>
                                      <input
                                        type="number"
                                        min={0}
                                        max={line.ordered_qty}
                                        value={edit.fulfilledQty}
                                        onChange={(e) => setLineEdits((prev) => ({
                                          ...prev,
                                          [line.id]: { ...edit, fulfilledQty: parseInt(e.target.value) || 0 },
                                        }))}
                                        className="w-20 bg-slate-700 border border-slate-600 rounded px-2 py-1.5 text-sm text-white outline-none focus:border-green-500"
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-xs text-slate-400 mb-1">BO数</label>
                                      <input
                                        type="number"
                                        min={0}
                                        max={line.ordered_qty - edit.fulfilledQty}
                                        value={edit.backorderedQty}
                                        onChange={(e) => setLineEdits((prev) => ({
                                          ...prev,
                                          [line.id]: { ...edit, backorderedQty: parseInt(e.target.value) || 0 },
                                        }))}
                                        className="w-20 bg-slate-700 border border-slate-600 rounded px-2 py-1.5 text-sm text-white outline-none focus:border-green-500"
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-xs text-slate-400 mb-1">メモ</label>
                                      <input
                                        type="text"
                                        value={edit.note}
                                        onChange={(e) => setLineEdits((prev) => ({
                                          ...prev,
                                          [line.id]: { ...edit, note: e.target.value },
                                        }))}
                                        placeholder="任意"
                                        className="w-32 bg-slate-700 border border-slate-600 rounded px-2 py-1.5 text-sm text-white placeholder:text-slate-500 outline-none focus:border-green-500"
                                      />
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    disabled={isPending}
                                    onClick={() => handleSaveLine(order.id, line.id)}
                                    className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-colors"
                                  >
                                    確定
                                  </button>
                                </>
                              )}

                              {/* Done state */}
                              {(isLineDone || !isFulfilling) && (
                                <div className="text-xs text-slate-400 flex gap-3">
                                  {line.fulfilled_qty > 0 && <span className="text-emerald-400">出荷: {line.fulfilled_qty}</span>}
                                  {line.backordered_qty > 0 && <span className="text-amber-400">BO: {line.backordered_qty}</span>}
                                  {line.remaining_qty > 0 && <span className="text-slate-500">残: {line.remaining_qty}</span>}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
