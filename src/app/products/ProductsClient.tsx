"use client";

import { useState, useTransition, useRef } from "react";
import { GyeonProductDB } from "@/lib/products/product-types";
import { importGyeonProductsCsv, ImportResult } from "@/lib/products/import-gyeon-products-csv";
import { searchGyeonProducts } from "@/lib/products/get-gyeon-products";

interface Props {
  initialProducts: GyeonProductDB[];
  categories:      string[];
}

const CATEGORY_LABELS: Record<string, string> = {
  coating:  "コーティング",
  ppf:      "PPF",
  window:   "ウィンドウ",
  interior: "インテリア",
  glass:    "ガラス",
  other:    "その他",
};

function categoryLabel(cat: string | null): string {
  if (!cat) return "—";
  return CATEGORY_LABELS[cat] ?? cat;
}

export default function ProductsClient({ initialProducts, categories }: Props) {
  const [products,    setProducts]    = useState<GyeonProductDB[]>(initialProducts);
  const [keyword,     setKeyword]     = useState("");
  const [category,    setCategory]    = useState("");
  const [activeOnly,  setActiveOnly]  = useState(false);
  const [isPending,   startTransition] = useTransition();
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importing,   setImporting]   = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function handleSearch() {
    startTransition(async () => {
      const results = await searchGyeonProducts(keyword, category || undefined);
      setProducts(activeOnly ? results.filter((p) => p.is_active) : results);
    });
  }

  async function handleFileImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportResult(null);

    try {
      const text = await file.text();
      const result = await importGyeonProductsCsv(text);
      setImportResult(result);
      // Refresh product list
      const updated = await searchGyeonProducts("", undefined);
      setProducts(updated);
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const displayProducts = activeOnly
    ? products.filter((p) => p.is_active)
    : products;

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-100">GYEON 商品カタログ</h1>
          <p className="text-xs text-slate-500 mt-0.5">{products.length}件の商品</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            onChange={handleFileImport}
            className="hidden"
            id="csv-import"
          />
          <label
            htmlFor="csv-import"
            className={`cursor-pointer px-3 py-1.5 text-xs font-medium rounded-md border border-slate-600 text-slate-300 hover:text-slate-100 hover:border-slate-400 transition-colors ${importing ? "opacity-50 pointer-events-none" : ""}`}
          >
            {importing ? "インポート中…" : "CSVインポート"}
          </label>
        </div>
      </div>

      {/* Import result */}
      {importResult && (
        <div className={`border rounded-lg px-4 py-3 text-sm ${importResult.errors.length > 0 ? "border-yellow-700 bg-yellow-900/20" : "border-green-700 bg-green-900/20"}`}>
          <p className="font-medium text-slate-100 mb-1">
            インポート完了: 新規 {importResult.inserted}件 / 更新 {importResult.updated}件
            {importResult.errors.length > 0 && ` / エラー ${importResult.errors.length}件`}
          </p>
          {importResult.errors.map((e, i) => (
            <p key={i} className="text-xs text-red-400">行{e.row} [{e.sku}]: {e.message}</p>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <input
          type="text"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          placeholder="商品名・SKUで検索…"
          className="bg-[#0f172a] border border-slate-700 rounded-md px-3 py-1.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600 flex-1 min-w-[200px]"
        />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="bg-[#0f172a] border border-slate-700 rounded-md px-3 py-1.5 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
        >
          <option value="">全カテゴリ</option>
          {categories.map((c) => (
            <option key={c} value={c}>{categoryLabel(c)}</option>
          ))}
        </select>
        <label className="flex items-center gap-1.5 text-xs text-slate-400 cursor-pointer">
          <input
            type="checkbox"
            checked={activeOnly}
            onChange={(e) => setActiveOnly(e.target.checked)}
            className="accent-blue-600"
          />
          有効のみ
        </label>
        <button
          type="button"
          onClick={handleSearch}
          disabled={isPending}
          className="px-3 py-1.5 text-xs font-medium bg-blue-700 hover:bg-blue-600 text-white rounded-md transition-colors disabled:opacity-50"
        >
          {isPending ? "検索中…" : "検索"}
        </button>
      </div>

      {/* Product grid */}
      {displayProducts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <p className="text-slate-500 text-sm">商品が登録されていません</p>
          <p className="text-slate-600 text-xs">CSVインポートで商品を追加してください</p>
          <a
            href="/docs/GYEON_PRODUCT_TEMPLATE.csv"
            className="text-xs text-blue-400 hover:underline"
            download
          >
            CSVテンプレートをダウンロード
          </a>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {displayProducts.map((p) => (
            <div
              key={p.id}
              className={`bg-[#0f172a] border rounded-xl p-4 flex flex-col gap-2 ${p.is_active ? "border-slate-800" : "border-slate-800 opacity-50"}`}
            >
              {/* Image */}
              <div className="w-full h-28 rounded-lg bg-slate-800 overflow-hidden flex items-center justify-center">
                {p.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.image_url} alt={p.product_name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-4xl text-slate-700">⊡</span>
                )}
              </div>

              {/* Info */}
              <div className="flex flex-col gap-1">
                <div className="flex items-start justify-between gap-1">
                  <h3 className="text-sm font-semibold text-slate-100 leading-tight">{p.product_name}</h3>
                  {!p.is_active && (
                    <span className="text-[9px] text-red-400 bg-red-900/30 border border-red-800/40 px-1 py-0.5 rounded shrink-0">無効</span>
                  )}
                </div>

                {p.size_label && (
                  <p className="text-xs text-slate-400">{p.size_label}</p>
                )}

                <p className="text-[10px] text-slate-500 font-mono">{p.sku}</p>

                {p.category && (
                  <span className="self-start text-[9px] text-slate-400 bg-slate-800 border border-slate-700 px-1.5 py-0.5 rounded">
                    {categoryLabel(p.category)}
                  </span>
                )}

                {p.description && (
                  <p className="text-xs text-slate-500 line-clamp-2">{p.description}</p>
                )}
              </div>

              {/* Price */}
              <div className="mt-auto pt-2 border-t border-slate-800">
                {p.retail_price != null ? (
                  <p className="text-sm font-bold text-slate-200">
                    ¥{p.retail_price.toLocaleString("ja-JP")}
                    <span className="text-xs font-normal text-slate-500 ml-1">（定価）</span>
                  </p>
                ) : (
                  <p className="text-xs text-slate-600">価格未設定</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
