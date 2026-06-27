"use client";

import { useState, useTransition, useCallback, useEffect } from "react";
import { upsertStockCount, getProductsWithStock } from "@/lib/inventory/inventory-actions";
import { createReceivingRecord, getRecentMovements } from "@/lib/inventory/receiving-actions";
import {
  MOVEMENT_TYPE_LABELS,
  type ProductWithStock,
  type StockCountInput,
  type CreateReceiptInput,
  type GetMovementsResult,
} from "@/lib/inventory/inventory-types";

interface Props {
  initialItems: ProductWithStock[];
  categories:   string[];
}

const CATEGORY_LABELS: Record<string, string> = {
  coating:  "コーティング",
  ppf:      "PPF",
  window:   "ウィンドウ",
  interior: "インテリア",
  glass:    "ガラス",
  other:    "その他",
};

function catLabel(c: string | null) {
  if (!c) return "—";
  return CATEGORY_LABELS[c] ?? c;
}

// ─── Stock count form ─────────────────────────────────────────────────────────

interface CountFormProps {
  item:     ProductWithStock;
  onSaved:  (item: ProductWithStock) => void;
  onCancel: () => void;
}

function CountForm({ item, onSaved, onCancel }: CountFormProps) {
  const defaultUnitsPerCase = item.units_per_case ?? 1;

  const [caseCount,    setCaseCount]    = useState(item.stock?.case_count    ?? 0);
  const [looseCount,   setLooseCount]   = useState(item.stock?.loose_count   ?? 0);
  const [unitsPerCase, setUnitsPerCase] = useState(item.stock?.units_per_case_used ?? defaultUnitsPerCase);
  const [notes,        setNotes]        = useState(item.stock?.notes ?? "");
  const [error,        setError]        = useState<string | null>(null);
  const [isPending,    startTransition] = useTransition();

  const total = Math.max(0, caseCount) * Math.max(1, unitsPerCase) + Math.max(0, looseCount);

  function handleInt(val: string, setter: (n: number) => void, min = 0) {
    const n = parseInt(val, 10);
    setter(isNaN(n) ? min : Math.max(min, n));
  }

  function handleSave() {
    setError(null);
    const input: StockCountInput = {
      product_id:          item.product_id,
      case_count:          caseCount,
      loose_count:         looseCount,
      units_per_case_used: unitsPerCase,
      notes:               notes || undefined,
    };
    startTransition(async () => {
      const result = await upsertStockCount(input);
      if (!result.success) { setError(result.error); return; }
      onSaved({ ...item, stock: result.stock });
    });
  }

  const inputCls =
    "w-full bg-[#0f172a] border border-slate-700 rounded-md px-3 py-2 text-sm text-slate-100 text-right tabular-nums focus:outline-none focus:ring-1 focus:ring-blue-600";

  return (
    <div className="mt-2 rounded-xl border border-blue-600/30 bg-blue-950/10 p-4 flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <label className="text-xs text-slate-400 w-28 shrink-0">1ケース入数</label>
        <input type="number" min={1} value={unitsPerCase}
          onChange={e => handleInt(e.target.value, setUnitsPerCase, 1)}
          className={inputCls + " flex-1"} />
        <span className="text-xs text-slate-500 shrink-0">本/ケース</span>
      </div>
      <div className="flex items-center gap-3">
        <label className="text-xs text-slate-400 w-28 shrink-0">ケース数</label>
        <input type="number" min={0} value={caseCount}
          onChange={e => handleInt(e.target.value, setCaseCount)}
          className={inputCls + " flex-1"} />
        <span className="text-xs text-slate-500 shrink-0">ケース</span>
      </div>
      <div className="flex items-center gap-3">
        <label className="text-xs text-slate-400 w-28 shrink-0">バラ数</label>
        <input type="number" min={0} value={looseCount}
          onChange={e => handleInt(e.target.value, setLooseCount)}
          className={inputCls + " flex-1"} />
        <span className="text-xs text-slate-500 shrink-0">本</span>
      </div>
      <div className="flex items-center justify-between rounded-lg bg-[#0f172a] border border-slate-800 px-4 py-2.5">
        <span className="text-xs text-slate-500">
          {total.toLocaleString("ja-JP")}本 = {caseCount}ケース × {unitsPerCase}本/ケース + {looseCount}バラ
        </span>
        <span className="text-lg font-bold text-slate-100 tabular-nums">
          {total.toLocaleString("ja-JP")} <span className="text-xs font-normal text-slate-500">本</span>
        </span>
      </div>
      <div className="flex items-start gap-3">
        <label className="text-xs text-slate-400 w-28 shrink-0 pt-2">備考</label>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
          placeholder="例: 棚A-3 / 破損1ケース除く"
          className="flex-1 bg-[#0f172a] border border-slate-700 rounded-md px-3 py-2 text-xs text-slate-100 placeholder-slate-600 resize-none focus:outline-none focus:ring-1 focus:ring-blue-600" />
      </div>
      {error && <p className="text-xs text-red-400 flex items-center gap-1"><span>✕</span> {error}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={onCancel} disabled={isPending}
          className="flex-1 py-2 rounded-lg border border-slate-700 text-xs text-slate-400 hover:text-slate-100 hover:border-slate-500 transition-colors disabled:opacity-40">
          キャンセル
        </button>
        <button type="button" onClick={handleSave} disabled={isPending}
          className="flex-1 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium transition-colors disabled:opacity-40">
          {isPending ? "保存中..." : "在庫を保存"}
        </button>
      </div>
    </div>
  );
}

// ─── Receiving form ───────────────────────────────────────────────────────────

interface ReceivingFormProps {
  item:     ProductWithStock;
  onSaved:  (item: ProductWithStock) => void;
  onCancel: () => void;
}

function ReceivingForm({ item, onSaved, onCancel }: ReceivingFormProps) {
  const defaultUnitsPerCase = item.units_per_case ?? item.stock?.units_per_case_used ?? 1;

  const [caseCount,  setCaseCount]  = useState(0);
  const [looseCount, setLooseCount] = useState(0);
  const [upc,        setUpc]        = useState(defaultUnitsPerCase);
  const [note,       setNote]       = useState("");
  const [error,      setError]      = useState<string | null>(null);
  const [isPending,  startTransition] = useTransition();

  const incomingTotal = Math.max(0, caseCount) * Math.max(1, upc) + Math.max(0, looseCount);
  const afterTotal    = (item.stock?.total_quantity ?? 0) + incomingTotal;

  function handleInt(val: string, setter: (n: number) => void, min = 0) {
    const n = parseInt(val, 10);
    setter(isNaN(n) ? min : Math.max(min, n));
  }

  function handleSave() {
    setError(null);
    if (incomingTotal <= 0) {
      setError("入荷数量は1以上を入力してください");
      return;
    }
    const input: CreateReceiptInput = {
      product_id:              item.product_id,
      case_count:              caseCount,
      loose_count:             looseCount,
      units_per_case_snapshot: upc,
      note:                    note || undefined,
    };
    startTransition(async () => {
      const result = await createReceivingRecord(input);
      if (!result.success) { setError(result.error); return; }
      onSaved({ ...item, stock: result.stock });
    });
  }

  const inputCls =
    "w-full bg-[#0f172a] border border-slate-700 rounded-md px-3 py-2 text-sm text-slate-100 text-right tabular-nums focus:outline-none focus:ring-1 focus:ring-emerald-600";

  return (
    <div className="mt-2 rounded-xl border border-emerald-600/30 bg-emerald-950/10 p-4 flex flex-col gap-3">
      {/* Current stock context */}
      <div className="flex items-center justify-between text-xs px-1">
        <span className="text-slate-500">現在庫</span>
        <span className="text-slate-400 font-medium tabular-nums">
          {(item.stock?.total_quantity ?? 0).toLocaleString("ja-JP")}本
        </span>
      </div>
      <div className="flex items-center gap-3">
        <label className="text-xs text-slate-400 w-28 shrink-0">1ケース入数</label>
        <input type="number" min={1} value={upc}
          onChange={e => handleInt(e.target.value, setUpc, 1)}
          className={inputCls + " flex-1"} />
        <span className="text-xs text-slate-500 shrink-0">本/ケース</span>
      </div>
      <div className="flex items-center gap-3">
        <label className="text-xs text-slate-400 w-28 shrink-0">入荷ケース数</label>
        <input type="number" min={0} value={caseCount}
          onChange={e => handleInt(e.target.value, setCaseCount)}
          className={inputCls + " flex-1"} />
        <span className="text-xs text-slate-500 shrink-0">ケース</span>
      </div>
      <div className="flex items-center gap-3">
        <label className="text-xs text-slate-400 w-28 shrink-0">入荷バラ数</label>
        <input type="number" min={0} value={looseCount}
          onChange={e => handleInt(e.target.value, setLooseCount)}
          className={inputCls + " flex-1"} />
        <span className="text-xs text-slate-500 shrink-0">本</span>
      </div>
      {/* Preview */}
      <div className="rounded-lg bg-[#0f172a] border border-slate-800 px-4 py-2.5 flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-500">入荷数</span>
          <span className="text-sm font-semibold text-emerald-400 tabular-nums">
            +{incomingTotal.toLocaleString("ja-JP")}本
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-500">入荷後残高</span>
          <span className="text-lg font-bold text-slate-100 tabular-nums">
            {afterTotal.toLocaleString("ja-JP")} <span className="text-xs font-normal text-slate-500">本</span>
          </span>
        </div>
        <p className="text-[10px] text-slate-600 mt-0.5">
          {incomingTotal.toLocaleString("ja-JP")}本 = {caseCount}ケース × {upc}本/ケース + {looseCount}バラ
        </p>
      </div>
      <div className="flex items-start gap-3">
        <label className="text-xs text-slate-400 w-28 shrink-0 pt-2">備考</label>
        <textarea value={note} onChange={e => setNote(e.target.value)} rows={2}
          placeholder="例: 発注番号 / 倉庫入庫"
          className="flex-1 bg-[#0f172a] border border-slate-700 rounded-md px-3 py-2 text-xs text-slate-100 placeholder-slate-600 resize-none focus:outline-none focus:ring-1 focus:ring-emerald-600" />
      </div>
      {error && <p className="text-xs text-red-400 flex items-center gap-1"><span>✕</span> {error}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={onCancel} disabled={isPending}
          className="flex-1 py-2 rounded-lg border border-slate-700 text-xs text-slate-400 hover:text-slate-100 hover:border-slate-500 transition-colors disabled:opacity-40">
          キャンセル
        </button>
        <button type="button" onClick={handleSave} disabled={isPending}
          className="flex-1 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium transition-colors disabled:opacity-40">
          {isPending ? "登録中..." : "入荷を登録"}
        </button>
      </div>
    </div>
  );
}

// ─── Movement history (inline) ────────────────────────────────────────────────

function MovementHistory({ productId }: { productId: string }) {
  const [movements, setMovements] = useState<GetMovementsResult>([]);
  const [loading,   setLoading]   = useState(true);

  useEffect(() => {
    let cancelled = false;
    getRecentMovements(productId, 5).then(data => {
      if (!cancelled) {
        setMovements(data);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [productId]);

  if (loading) {
    return <p className="text-[10px] text-slate-600 py-1">履歴を読み込み中...</p>;
  }
  if (movements.length === 0) {
    return <p className="text-[10px] text-slate-600 py-1">履歴なし</p>;
  }

  return (
    <div className="flex flex-col gap-0.5">
      {movements.map(m => {
        const isIn  = m.quantity_delta > 0;
        const label = MOVEMENT_TYPE_LABELS[m.movement_type] ?? m.movement_type;
        const date  = new Date(m.created_at).toLocaleDateString("ja-JP", {
          month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit",
        });
        return (
          <div key={m.id} className="flex items-center gap-2 text-[10px] text-slate-500 py-0.5">
            <span className={`shrink-0 font-medium tabular-nums ${isIn ? "text-emerald-500" : "text-red-400"}`}>
              {isIn ? "+" : ""}{m.quantity_delta.toLocaleString("ja-JP")}本
            </span>
            <span className="shrink-0 text-slate-600 bg-slate-800 px-1 py-0.5 rounded">{label}</span>
            <span className="text-slate-700 tabular-nums shrink-0">{date}</span>
            {m.note && <span className="text-slate-700 truncate">{m.note}</span>}
          </div>
        );
      })}
    </div>
  );
}

// ─── Product row ──────────────────────────────────────────────────────────────

type FormMode = "count" | "receive";

interface ProductRowProps {
  item:      ProductWithStock;
  openMode:  FormMode | null;
  onOpen:    (mode: FormMode) => void;
  onSaved:   (updated: ProductWithStock) => void;
  onCancel:  () => void;
}

function ProductRow({ item, openMode, onOpen, onSaved, onCancel }: ProductRowProps) {
  const { stock } = item;

  // "75本 = 12ケース + 3バラ"
  const stockBreakdown = stock
    ? `${stock.total_quantity.toLocaleString("ja-JP")}本 = ${stock.case_count}ケース + ${stock.loose_count}バラ`
    : null;

  const lastCounted = stock?.last_counted_at
    ? new Date(stock.last_counted_at).toLocaleDateString("ja-JP", {
        month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit",
      })
    : null;

  return (
    <div className="bg-[#0f172a] border border-slate-800 rounded-xl px-4 py-3 flex flex-col gap-1">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-0.5 flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-100 truncate">{item.product_name}</p>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-mono text-slate-500">{item.sku}</span>
            {item.category && (
              <span className="text-[9px] text-slate-500 bg-slate-800 border border-slate-700 px-1.5 py-0.5 rounded">
                {catLabel(item.category)}
              </span>
            )}
            {item.size_label && (
              <span className="text-[10px] text-slate-500">{item.size_label}</span>
            )}
            {item.units_per_case != null && (
              <span className="text-[9px] text-blue-400/70 bg-blue-950/30 border border-blue-900/40 px-1.5 py-0.5 rounded">
                {item.units_per_case}本/ケース
              </span>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-1.5 shrink-0">
          <button type="button"
            onClick={() => openMode === "receive" ? onCancel() : onOpen("receive")}
            className={`text-xs px-2.5 py-1.5 rounded-lg border transition-colors ${
              openMode === "receive"
                ? "border-slate-600 text-slate-400 hover:text-slate-200"
                : "border-emerald-700/50 text-emerald-400 hover:bg-emerald-950/30 hover:border-emerald-600"
            }`}>
            {openMode === "receive" ? "閉じる" : "入荷"}
          </button>
          <button type="button"
            onClick={() => openMode === "count" ? onCancel() : onOpen("count")}
            className={`text-xs px-2.5 py-1.5 rounded-lg border transition-colors ${
              openMode === "count"
                ? "border-slate-600 text-slate-400 hover:text-slate-200"
                : "border-blue-700/50 text-blue-400 hover:bg-blue-950/30 hover:border-blue-600"
            }`}>
            {openMode === "count" ? "閉じる" : "棚卸"}
          </button>
        </div>
      </div>

      {/* Stock summary */}
      {stock ? (
        <div className="flex items-center gap-3 mt-1">
          <span className="text-xs text-slate-300 font-medium tabular-nums">{stockBreakdown}</span>
          {lastCounted && (
            <span className="text-[10px] text-slate-600">{lastCounted} 計測</span>
          )}
        </div>
      ) : (
        <p className="text-xs text-slate-600 mt-1">未カウント</p>
      )}

      {/* Active form */}
      {openMode === "receive" && (
        <ReceivingForm item={item} onSaved={onSaved} onCancel={onCancel} />
      )}
      {openMode === "count" && (
        <CountForm item={item} onSaved={onSaved} onCancel={onCancel} />
      )}

      {/* Movement history — shown when any form is open */}
      {openMode !== null && (
        <div className="mt-2 border-t border-slate-800/60 pt-2">
          <p className="text-[10px] text-slate-600 mb-1">直近の動き</p>
          <MovementHistory productId={item.product_id} />
        </div>
      )}
    </div>
  );
}

// ─── Main client ──────────────────────────────────────────────────────────────

export default function InventoryClient({ initialItems, categories }: Props) {
  const [items,    setItems]    = useState<ProductWithStock[]>(initialItems);
  const [keyword,  setKeyword]  = useState("");
  const [category, setCategory] = useState("");
  const [active,   setActive]   = useState<{ id: string; mode: FormMode } | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSearch() {
    startTransition(async () => {
      const results = await getProductsWithStock(keyword || undefined, category || undefined);
      setItems(results);
      setActive(null);
    });
  }

  const handleSaved = useCallback((updated: ProductWithStock) => {
    setItems(prev => prev.map(i => i.product_id === updated.product_id ? updated : i));
    setActive(null);
  }, []);

  const countedCount = items.filter(i => i.stock !== null).length;
  const totalStock   = items.reduce((s, i) => s + (i.stock?.total_quantity ?? 0), 0);

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-100">在庫管理</h1>
        <p className="text-xs text-slate-500 mt-0.5">
          {items.length}商品 / {countedCount}商品カウント済み / 合計 {totalStock.toLocaleString("ja-JP")}本
        </p>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-3 px-3 py-2 rounded-lg border border-slate-800 bg-slate-900/40 text-xs text-slate-500">
        <span><span className="text-emerald-400 font-medium">入荷</span> — 現在庫に加算</span>
        <span className="text-slate-700">|</span>
        <span><span className="text-blue-400 font-medium">棚卸</span> — 絶対数量をセット</span>
        <span className="text-slate-700 ml-auto font-mono hidden sm:inline">合計 = ケース × 入数 + バラ</span>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <input type="text" value={keyword}
          onChange={e => setKeyword(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleSearch()}
          placeholder="商品名・SKUで検索..."
          className="bg-[#0f172a] border border-slate-700 rounded-md px-3 py-1.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-600 flex-1 min-w-[200px]" />
        <select value={category} onChange={e => setCategory(e.target.value)}
          className="bg-[#0f172a] border border-slate-700 rounded-md px-3 py-1.5 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-600">
          <option value="">全カテゴリ</option>
          {categories.map(c => (
            <option key={c} value={c}>{catLabel(c)}</option>
          ))}
        </select>
        <button type="button" onClick={handleSearch} disabled={isPending}
          className="px-3 py-1.5 text-xs font-medium bg-blue-700 hover:bg-blue-600 text-white rounded-md transition-colors disabled:opacity-50">
          {isPending ? "検索中..." : "検索"}
        </button>
      </div>

      {/* Product list */}
      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-2">
          <p className="text-slate-500 text-sm">商品が登録されていません</p>
          <p className="text-slate-600 text-xs">商品カタログから商品を追加してください</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {items.map(item => (
            <ProductRow
              key={item.product_id}
              item={item}
              openMode={active?.id === item.product_id ? active.mode : null}
              onOpen={mode => setActive({ id: item.product_id, mode })}
              onSaved={handleSaved}
              onCancel={() => setActive(null)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
