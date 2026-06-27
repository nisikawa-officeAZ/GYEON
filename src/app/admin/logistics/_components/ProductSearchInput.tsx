"use client";

import { useState, useRef, useEffect } from "react";

export interface ProductForSearch {
  id:           string;
  sku:          string;
  product_name: string;
  units_per_case: number | null;
  jan_code?:    string | null;
}

interface Props {
  products:    ProductForSearch[];
  selectedId:  string;
  onSelect:    (product: ProductForSearch) => void;
  placeholder?: string;
  disabled?:   boolean;
}

export default function ProductSearchInput({ products, selectedId, onSelect, placeholder = "商品名・SKU・JAN検索", disabled }: Props) {
  const [query, setQuery]         = useState("");
  const [open, setOpen]           = useState(false);
  const containerRef              = useRef<HTMLDivElement>(null);

  // Show selected product name when closed
  const selected = products.find((p) => p.id === selectedId);

  const filtered = query.trim()
    ? products.filter((p) => {
        const q = query.trim().toLowerCase();
        return (
          p.product_name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          (p.jan_code && p.jan_code.includes(q))
        );
      }).slice(0, 8)
    : [];

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        disabled={disabled}
        value={open ? query : (selected ? `${selected.sku} - ${selected.product_name}` : "")}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => { setQuery(""); setOpen(true); }}
        placeholder={placeholder}
        className={[
          "w-full px-3 py-2 bg-slate-700/50 border rounded-lg text-sm text-slate-100 outline-none",
          "placeholder:text-slate-500 transition-colors",
          disabled ? "opacity-50 cursor-not-allowed border-slate-700" : "border-slate-600 focus:border-green-500",
        ].join(" ")}
      />

      {open && filtered.length > 0 && (
        <div className="absolute z-20 w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg shadow-xl overflow-hidden max-h-64 overflow-y-auto">
          {filtered.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => { onSelect(p); setOpen(false); setQuery(""); }}
              className="w-full text-left px-3 py-2.5 hover:bg-slate-700 transition-colors border-b border-slate-700/50 last:border-0"
            >
              <div className="text-sm text-slate-100 font-medium">{p.product_name}</div>
              <div className="text-xs text-slate-400 mt-0.5 flex gap-3">
                <span>{p.sku}</span>
                {p.jan_code && <span>JAN: {p.jan_code}</span>}
                {p.units_per_case && <span>{p.units_per_case}本/ケース</span>}
              </div>
            </button>
          ))}
        </div>
      )}

      {open && query.trim() && filtered.length === 0 && (
        <div className="absolute z-20 w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg shadow-xl p-3 text-sm text-slate-400">
          「{query}」に一致する商品が見つかりません
        </div>
      )}
    </div>
  );
}
