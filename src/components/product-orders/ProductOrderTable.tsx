"use client";

import { useState, useTransition } from "react";
import {
  ProductOrderDB,
  orderDisplayNo,
  orderStatusLabel,
  orderStatusColor,
  orderTotal,
} from "@/lib/product-orders/product-order-types";
import { updateProductOrderStatus } from "@/lib/product-orders/update-product-order";

interface Props {
  orders:    ProductOrderDB[];
  onRefresh: () => void;
}

export default function ProductOrderTable({ orders, onRefresh }: Props) {
  const [expandedId, setExpandedId]     = useState<string | null>(null);
  const [isPending,  startTransition]   = useTransition();
  const [actionErr,  setActionErr]      = useState<string | null>(null);

  function toggleExpand(id: string) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  function handleStatus(id: string, status: ProductOrderDB["status"]) {
    setActionErr(null);
    startTransition(async () => {
      const result = await updateProductOrderStatus(id, status);
      if (!result.success) setActionErr(result.error ?? "エラー");
      else onRefresh();
    });
  }

  function handlePrint(order: ProductOrderDB) {
    const items = order.product_order_items ?? [];
    const total  = orderTotal(items);
    const html = `
<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="utf-8" />
<title>注文書 ${orderDisplayNo(order)}</title>
<style>
  body { font-family: sans-serif; padding: 32px; color: #111; font-size: 13px; }
  h1 { font-size: 18px; margin-bottom: 4px; }
  .meta { color: #555; font-size: 12px; margin-bottom: 24px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #ccc; padding: 6px 10px; text-align: left; }
  th { background: #f3f4f6; font-size: 11px; }
  .right { text-align: right; }
  .total { font-weight: bold; font-size: 14px; }
</style>
</head>
<body>
<h1>注文書</h1>
<div class="meta">
  注文番号: ${orderDisplayNo(order)}<br/>
  注文日: ${order.order_date ?? "—"}<br/>
  ステータス: ${orderStatusLabel(order.status)}<br/>
  ${order.notes ? `備考: ${order.notes}` : ""}
</div>
<table>
  <thead>
    <tr>
      <th>SKU</th>
      <th>商品名</th>
      <th class="right">定価</th>
      <th class="right">数量</th>
      <th class="right">小計</th>
    </tr>
  </thead>
  <tbody>
    ${items.map((it) => `
    <tr>
      <td>${it.sku}</td>
      <td>${it.product_name_snapshot}</td>
      <td class="right">${it.retail_price_snapshot != null ? "¥" + it.retail_price_snapshot.toLocaleString("ja-JP") : "—"}</td>
      <td class="right">${it.quantity}</td>
      <td class="right">¥${it.subtotal.toLocaleString("ja-JP")}</td>
    </tr>`).join("")}
  </tbody>
  <tfoot>
    <tr>
      <td colspan="4" class="right total">合計（定価ベース）</td>
      <td class="right total">¥${total.toLocaleString("ja-JP")}</td>
    </tr>
  </tfoot>
</table>
</body>
</html>`;

    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.print();
  }

  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-2">
        <p className="text-slate-500 text-sm">注文がありません</p>
        <p className="text-slate-600 text-xs">「新規注文」から商品注文を作成してください</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      {actionErr && (
        <div className="bg-red-900/30 border border-red-700 rounded-lg px-3 py-2 mb-2">
          <p className="text-xs text-red-400">{actionErr}</p>
        </div>
      )}

      {orders.map((order) => {
        const items   = order.product_order_items ?? [];
        const total   = orderTotal(items);
        const isOpen  = expandedId === order.id;

        return (
          <div key={order.id} className="bg-[#0f172a] border border-slate-800 rounded-xl overflow-hidden">
            {/* Row */}
            <button
              type="button"
              onClick={() => toggleExpand(order.id)}
              className="w-full grid grid-cols-[1fr_80px_70px_80px_100px] gap-3 items-center px-4 py-3 hover:bg-slate-800/40 transition-colors text-left"
            >
              <div>
                <p className="text-sm font-medium text-slate-100">{orderDisplayNo(order)}</p>
                <p className="text-xs text-slate-500">{order.order_date ?? "—"}</p>
              </div>
              <span className="text-xs text-slate-400 text-right">{items.length}点</span>
              <span className="text-xs text-slate-300 text-right font-medium">
                ¥{total.toLocaleString("ja-JP")}
              </span>
              <span className={`text-xs font-medium text-right ${orderStatusColor(order.status)}`}>
                {orderStatusLabel(order.status)}
              </span>
              <span className="text-[10px] text-slate-600 text-right">
                {isOpen ? "▲ 閉じる" : "▼ 詳細"}
              </span>
            </button>

            {/* Expanded detail */}
            {isOpen && (
              <div className="border-t border-slate-700/60 px-4 pb-4 pt-3 flex flex-col gap-3">
                {/* Items table */}
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-700 text-slate-500">
                      <th className="text-left pb-2 font-medium">SKU</th>
                      <th className="text-left pb-2 font-medium">商品名</th>
                      <th className="text-right pb-2 font-medium">定価</th>
                      <th className="text-right pb-2 font-medium">数量</th>
                      <th className="text-right pb-2 font-medium">小計</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((it) => (
                      <tr key={it.id} className="border-b border-slate-800 last:border-b-0">
                        <td className="py-1.5 text-slate-500 font-mono">{it.sku}</td>
                        <td className="py-1.5 text-slate-200">{it.product_name_snapshot}</td>
                        <td className="py-1.5 text-slate-400 text-right">
                          {it.retail_price_snapshot != null
                            ? `¥${it.retail_price_snapshot.toLocaleString("ja-JP")}`
                            : "—"}
                        </td>
                        <td className="py-1.5 text-slate-200 text-right">{it.quantity}</td>
                        <td className="py-1.5 text-slate-200 text-right font-medium">
                          ¥{it.subtotal.toLocaleString("ja-JP")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {order.notes && (
                  <p className="text-xs text-slate-500">備考: {order.notes}</p>
                )}

                {/* Actions */}
                <div className="flex items-center gap-2 flex-wrap pt-1">
                  <button
                    type="button"
                    onClick={() => handlePrint(order)}
                    className="px-3 py-1.5 text-xs font-medium rounded-md border border-slate-600 text-slate-300 hover:text-slate-100 hover:border-slate-400 transition-colors"
                  >
                    印刷
                  </button>

                  {order.status === "draft" && (
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => handleStatus(order.id, "submitted")}
                      className="px-3 py-1.5 text-xs font-medium rounded-md bg-blue-700 hover:bg-blue-600 text-white transition-colors disabled:opacity-50"
                    >
                      注文確定
                    </button>
                  )}
                  {order.status === "submitted" && (
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => handleStatus(order.id, "approved")}
                      className="px-3 py-1.5 text-xs font-medium rounded-md bg-green-700 hover:bg-green-600 text-white transition-colors disabled:opacity-50"
                    >
                      承認
                    </button>
                  )}
                  {(order.status === "draft" || order.status === "submitted") && (
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => handleStatus(order.id, "cancelled")}
                      className="px-3 py-1.5 text-xs font-medium rounded-md border border-red-800 text-red-400 hover:bg-red-900/30 transition-colors disabled:opacity-50"
                    >
                      キャンセル
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
