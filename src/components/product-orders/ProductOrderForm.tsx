"use client";

import { useState, useTransition } from "react";
import ProductSelector from "@/components/products/ProductSelector";
import { GyeonProductDB } from "@/lib/products/product-types";
import {
  createProductOrder,
  ProductOrderItemInput,
} from "@/lib/product-orders/create-product-order";
import { ProductOrderDB } from "@/lib/product-orders/product-order-types";

interface OrderRow extends ProductOrderItemInput {
  key: number;
}

let _key = 0;
function nextKey() { return ++_key; }

interface Props {
  onSaved: (order: ProductOrderDB) => void;
  onCancel?: () => void;
}

export default function ProductOrderForm({ onSaved, onCancel }: Props) {
  const [rows,                setRows]                = useState<OrderRow[]>([]);
  const [orderDate,           setOrderDate]           = useState(new Date().toISOString().slice(0, 10));
  const [notes,               setNotes]               = useState("");
  const [submitAsSubmitted,   setSubmitAsSubmitted]   = useState(false);
  const [showSelector,        setShowSelector]        = useState(false);
  const [error,               setError]               = useState<string | null>(null);
  const [isPending,           startTransition]        = useTransition();

  function addProduct(product: GyeonProductDB) {
    // If already in list, increment quantity
    const existing = rows.find((r) => r.sku === product.sku);
    if (existing) {
      setRows((prev) =>
        prev.map((r) => r.key === existing.key ? { ...r, quantity: r.quantity + 1 } : r),
      );
      return;
    }
    setRows((prev) => [
      ...prev,
      {
        key:                   nextKey(),
        product_id:            product.id,
        sku:                   product.sku,
        product_name_snapshot: product.product_name + (product.size_label ? ` ${product.size_label}` : ""),
        retail_price_snapshot: product.retail_price,
        quantity:              1,
      },
    ]);
  }

  function updateQty(key: number, qty: number) {
    if (qty < 1) return;
    setRows((prev) => prev.map((r) => r.key === key ? { ...r, quantity: qty } : r));
  }

  function removeRow(key: number) {
    setRows((prev) => prev.filter((r) => r.key !== key));
  }

  const total = rows.reduce(
    (s, r) => s + (r.retail_price_snapshot ?? 0) * r.quantity,
    0,
  );

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (rows.length === 0) { setError("商品を1つ以上追加してください"); return; }

    startTransition(async () => {
      const result = await createProductOrder({
        items:      rows.map(({ key: _k, ...item }) => item),
        order_date: orderDate,
        notes:      notes || null,
        status:     submitAsSubmitted ? "submitted" : "draft",
      });

      if ("error" in result) {
        setError(result.error);
      } else {
        onSaved(result.data);
      }
    });
  }

  const inputClass =
    "bg-[#0f172a] border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600 w-full";

  return (
    <>
      {showSelector && (
        <ProductSelector
          onSelect={addProduct}
          onClose={() => setShowSelector(false)}
        />
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        {error && (
          <div className="bg-red-900/30 border border-red-700 rounded-lg px-3 py-2">
            <p className="text-xs text-red-400">{error}</p>
          </div>
        )}

        {/* Header fields */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-400">注文日</label>
            <input
              type="date"
              value={orderDate}
              onChange={(e) => setOrderDate(e.target.value)}
              className={inputClass}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-400">備考</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="社内メモ（任意）"
              className={inputClass}
            />
          </div>
        </div>

        {/* Item list */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">注文商品</span>
            <button
              type="button"
              onClick={() => setShowSelector(true)}
              className="text-xs text-emerald-500 hover:text-emerald-400 font-medium transition-colors"
            >
              + GYEON商品を追加
            </button>
          </div>

          {rows.length === 0 ? (
            <div className="border border-dashed border-slate-700 rounded-xl flex flex-col items-center justify-center py-10 gap-2">
              <p className="text-sm text-slate-500">商品が追加されていません</p>
              <button
                type="button"
                onClick={() => setShowSelector(true)}
                className="text-xs text-blue-400 hover:underline"
              >
                + GYEON商品を追加
              </button>
            </div>
          ) : (
            <div className="border border-slate-700 rounded-xl overflow-hidden">
              {/* Table header */}
              <div className="grid grid-cols-[1fr_80px_80px_90px_32px] gap-2 px-4 py-2 bg-slate-800/50 text-[10px] font-medium text-slate-500">
                <span>商品</span>
                <span className="text-right">定価</span>
                <span className="text-center">数量</span>
                <span className="text-right">小計</span>
                <span />
              </div>

              {rows.map((row) => {
                const subtotal = (row.retail_price_snapshot ?? 0) * row.quantity;
                return (
                  <div
                    key={row.key}
                    className="grid grid-cols-[1fr_80px_80px_90px_32px] gap-2 items-center px-4 py-2.5 border-t border-slate-700/60"
                  >
                    <div className="min-w-0">
                      <p className="text-sm text-slate-100 truncate">{row.product_name_snapshot}</p>
                      <p className="text-[10px] text-slate-500 font-mono">{row.sku}</p>
                    </div>
                    <span className="text-xs text-slate-400 text-right">
                      {row.retail_price_snapshot != null
                        ? `¥${row.retail_price_snapshot.toLocaleString("ja-JP")}`
                        : "—"}
                    </span>
                    <input
                      type="number"
                      value={row.quantity}
                      min={1}
                      onChange={(e) => updateQty(row.key, parseInt(e.target.value, 10) || 1)}
                      className="bg-[#0f172a] border border-slate-700 rounded px-2 py-1 text-xs text-slate-100 text-center focus:outline-none focus:ring-1 focus:ring-blue-600 w-full"
                    />
                    <span className="text-xs font-medium text-slate-200 text-right">
                      ¥{subtotal.toLocaleString("ja-JP")}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeRow(row.key)}
                      className="text-slate-600 hover:text-red-400 transition-colors text-sm leading-none"
                    >
                      ✕
                    </button>
                  </div>
                );
              })}

              {/* Total */}
              <div className="flex justify-end items-center gap-3 px-4 py-3 bg-slate-800/30 border-t border-slate-700">
                <span className="text-xs text-slate-400">合計（定価ベース）</span>
                <span className="text-sm font-bold text-slate-100">
                  ¥{total.toLocaleString("ja-JP")}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Submit */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-700">
          <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
            <input
              type="checkbox"
              checked={submitAsSubmitted}
              onChange={(e) => setSubmitAsSubmitted(e.target.checked)}
              className="accent-blue-600"
            />
            保存と同時に注文確定する
          </label>

          <div className="flex gap-2">
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                disabled={isPending}
                className="px-4 py-2 text-sm text-slate-400 hover:text-slate-100 hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50"
              >
                キャンセル
              </button>
            )}
            <button
              type="submit"
              disabled={isPending || rows.length === 0}
              className="px-4 py-2 text-sm font-medium bg-blue-700 hover:bg-blue-600 text-white rounded-lg transition-colors disabled:opacity-50"
            >
              {isPending ? "作成中…" : submitAsSubmitted ? "注文を確定する" : "下書きとして保存"}
            </button>
          </div>
        </div>
      </form>
    </>
  );
}
