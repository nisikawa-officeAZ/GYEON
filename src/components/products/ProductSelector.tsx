"use client";

import { useState, useEffect, useTransition } from "react";
import { searchGyeonProducts, getGyeonProductCategories } from "@/lib/products/get-gyeon-products";
import { GyeonProductDB } from "@/lib/products/product-types";

interface Props {
  onSelect: (product: GyeonProductDB) => void;
  onClose:  () => void;
}

export default function ProductSelector({ onSelect, onClose }: Props) {
  const [keyword,    setKeyword]    = useState("");
  const [category,   setCategory]   = useState("");
  const [categories, setCategories] = useState<string[]>([]);
  const [products,   setProducts]   = useState<GyeonProductDB[]>([]);
  const [isPending,  startTransition] = useTransition();

  // Load categories once
  useEffect(() => {
    getGyeonProductCategories().then(setCategories);
  }, []);

  // Search on keyword / category change (debounced)
  useEffect(() => {
    const t = setTimeout(() => {
      startTransition(async () => {
        const results = await searchGyeonProducts(keyword, category || undefined);
        setProducts(results);
      });
    }, 200);
    return () => clearTimeout(t);
  }, [keyword, category]);

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Panel */}
      <div className="bg-[#0f172a] border border-slate-700 rounded-xl shadow-2xl w-full max-w-2xl mx-4 flex flex-col max-h-[80vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
          <h2 className="text-sm font-semibold text-slate-100">GYEON 商品を選択</h2>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-300 text-lg leading-none"
          >
            ✕
          </button>
        </div>

        {/* Filters */}
        <div className="flex gap-2 px-4 py-3 border-b border-slate-700">
          <input
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="商品名・SKU・説明で検索…"
            autoFocus
            className="flex-1 bg-slate-800 border border-slate-600 rounded-md px-3 py-1.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="bg-slate-800 border border-slate-600 rounded-md px-3 py-1.5 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
          >
            <option value="">全カテゴリ</option>
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        {/* Product list */}
        <div className="overflow-y-auto flex-1">
          {isPending && (
            <div className="flex items-center justify-center py-8">
              <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          {!isPending && products.length === 0 && (
            <div className="flex items-center justify-center py-10">
              <p className="text-sm text-slate-500">商品が見つかりません</p>
            </div>
          )}
          {!isPending && products.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => { onSelect(p); onClose(); }}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-800 border-b border-slate-800 transition-colors text-left"
            >
              {/* Product image */}
              <div className="w-12 h-12 shrink-0 rounded-md bg-slate-800 border border-slate-700 overflow-hidden flex items-center justify-center">
                {p.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.image_url}
                    alt={p.product_name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-2xl text-slate-600">⊡</span>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-100 truncate">{p.product_name}</span>
                  {p.size_label && (
                    <span className="text-xs text-slate-400 shrink-0">{p.size_label}</span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] text-slate-500 font-mono">{p.sku}</span>
                  {p.category && (
                    <span className="text-[10px] text-slate-600 bg-slate-800 px-1.5 py-0.5 rounded">{p.category}</span>
                  )}
                </div>
                {p.description && (
                  <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{p.description}</p>
                )}
              </div>

              {/* Price */}
              <div className="shrink-0 text-right">
                {p.retail_price != null ? (
                  <span className="text-sm font-semibold text-slate-200">
                    ¥{p.retail_price.toLocaleString("ja-JP")}
                  </span>
                ) : (
                  <span className="text-xs text-slate-600">価格未設定</span>
                )}
              </div>
            </button>
          ))}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-slate-700">
          <p className="text-xs text-slate-600">{products.length}件表示</p>
        </div>
      </div>
    </div>
  );
}
