"use client";

import { useState, useTransition, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  saveStocktakingCount,
  skipStocktakingItem,
  finalizeStocktaking,
  cancelStocktakingSession,
} from "@/lib/admin/logistics/stocktaking-actions";
import type {
  StocktakingItem,
  StocktakingSessionWithItems,
} from "@/lib/admin/logistics/stocktaking-types";

type Props = {
  sessionData: StocktakingSessionWithItems;
  adminId:     string;
};

type ActiveTab = "uncounted" | "counted";

export default function StocktakingSessionClient({ sessionData, adminId: _adminId }: Props) {
  const router = useRouter();
  const [items, setItems]                   = useState<StocktakingItem[]>(sessionData.items);
  const [barcodeInput, setBarcodeInput]     = useState("");
  const [selectedItem, setSelectedItem]     = useState<StocktakingItem | null>(null);
  const [caseCount, setCaseCount]           = useState("");
  const [looseCount, setLooseCount]         = useState("");
  const [lookupError, setLookupError]       = useState<string | null>(null);
  const [saveError, setSaveError]           = useState<string | null>(null);
  const [activeTab, setActiveTab]           = useState<ActiveTab>("uncounted");
  const [showFinalizeModal, setShowFinalizeModal] = useState(false);
  const [showCancelModal, setShowCancelModal]     = useState(false);
  const [saving, startSaving]               = useTransition();
  const [finalizing, startFinalizing]       = useTransition();
  const barcodeRef  = useRef<HTMLInputElement>(null);
  const caseRef     = useRef<HTMLInputElement>(null);

  const isReadOnly = sessionData.session.status !== "active";

  const pendingItems  = items.filter((i) => i.status === "pending");
  const countedItems  = items.filter((i) => i.status === "counted");
  const skippedItems  = items.filter((i) => i.status === "skipped");
  const doneCount     = countedItems.length + skippedItems.length;
  const totalCount    = items.length;
  const remaining     = pendingItems.length;

  const upc     = selectedItem?.units_per_case_snapshot ?? 1;
  const cases   = parseInt(caseCount || "0") || 0;
  const loose   = parseInt(looseCount || "0") || 0;
  const total   = cases * upc + loose;

  // Auto-focus barcode input on mount and after saving
  const focusBarcode = useCallback(() => {
    setTimeout(() => barcodeRef.current?.focus(), 80);
  }, []);

  useEffect(() => {
    if (!isReadOnly) focusBarcode();
  }, [isReadOnly, focusBarcode]);

  // ── Barcode lookup (local — all items pre-loaded) ─────────────────────────

  function handleBarcodeSubmit() {
    const q = barcodeInput.trim();
    if (!q) return;

    const found = items.find(
      (item) =>
        (item.barcode && item.barcode === q) ||
        item.sku.toLowerCase() === q.toLowerCase(),
    );

    if (!found) {
      setLookupError("商品が見つかりません。商品マスターを確認してください。");
      setSelectedItem(null);
      return;
    }

    setLookupError(null);
    setSelectedItem(found);
    setBarcodeInput("");
    setCaseCount("0");
    setLooseCount("0");
    setTimeout(() => caseRef.current?.focus(), 80);
  }

  // ── Save count ────────────────────────────────────────────────────────────

  function handleSave() {
    if (!selectedItem) return;
    setSaveError(null);

    startSaving(async () => {
      const result = await saveStocktakingCount({
        sessionId: sessionData.session.id,
        itemId:    selectedItem.id,
        caseCount: cases,
        looseCount: loose,
      });

      if (!result.success) {
        setSaveError(result.error);
        return;
      }

      setItems((prev) =>
        prev.map((item) =>
          item.id === selectedItem.id
            ? {
                ...item,
                case_count:       cases,
                loose_count:      loose,
                counted_quantity: result.countedQuantity,
                status:           "counted",
                counted_at:       new Date().toISOString(),
              }
            : item,
        ),
      );

      setSelectedItem(null);
      setCaseCount("");
      setLooseCount("");
      focusBarcode();
    });
  }

  // ── Skip item ─────────────────────────────────────────────────────────────

  function handleSkip() {
    if (!selectedItem) return;
    startSaving(async () => {
      const result = await skipStocktakingItem(sessionData.session.id, selectedItem.id);
      if (!result.success) { setSaveError(result.error ?? "スキップに失敗しました"); return; }
      setItems((prev) =>
        prev.map((item) =>
          item.id === selectedItem.id ? { ...item, status: "skipped" } : item,
        ),
      );
      setSelectedItem(null);
      setCaseCount("");
      setLooseCount("");
      focusBarcode();
    });
  }

  // ── Finalize ──────────────────────────────────────────────────────────────

  function handleFinalize() {
    startFinalizing(async () => {
      const result = await finalizeStocktaking(sessionData.session.id);
      if (!result.success) { setSaveError(result.error); return; }
      router.push("/admin/logistics/stocktaking");
    });
  }

  // ── Cancel ────────────────────────────────────────────────────────────────

  function handleCancel() {
    startFinalizing(async () => {
      const result = await cancelStocktakingSession(sessionData.session.id);
      if (!result.success) { setSaveError(result.error); return; }
      router.push("/admin/logistics/stocktaking");
    });
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const progressPct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-5">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-5">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-lg font-bold text-white">
              棚卸しセッション
              {sessionData.session.note && (
                <span className="ml-2 text-sm font-normal text-slate-400">— {sessionData.session.note}</span>
              )}
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              開始: {new Date(sessionData.session.started_at).toLocaleString("ja-JP", { dateStyle: "short", timeStyle: "short" })}
              {sessionData.adminName && ` — ${sessionData.adminName}`}
            </p>
          </div>
          {isReadOnly ? (
            <span className="text-xs px-3 py-1 rounded-full bg-slate-700 text-slate-400">
              {sessionData.session.status === "completed" ? "完了" : "キャンセル済"}
            </span>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={() => setShowCancelModal(true)}
                className="text-xs px-3 py-1.5 rounded-lg bg-slate-700 text-slate-400 hover:text-red-400 transition-colors"
              >
                中止
              </button>
              <button
                onClick={() => setShowFinalizeModal(true)}
                className="text-xs px-4 py-1.5 rounded-lg bg-green-700 hover:bg-green-600 text-white font-medium transition-colors"
              >
                棚卸し完了
              </button>
            </div>
          )}
        </div>

        {/* Progress */}
        <div className="flex items-center justify-between text-sm mb-2">
          <span className="text-white font-semibold">{doneCount} / {totalCount} 商品完了</span>
          <span className={`font-bold text-lg ${remaining > 0 ? "text-amber-400" : "text-green-400"}`}>
            残り {remaining} 商品
          </span>
        </div>
        <div className="h-2.5 bg-slate-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-emerald-500 rounded-full transition-all duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <p className="text-xs text-right text-slate-500 mt-1">{progressPct}%</p>
      </div>

      {/* ── Barcode scanner input ──────────────────────────────────────────── */}
      {!isReadOnly && (
        <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-5">
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
            バーコードスキャン / 商品検索
          </label>

          <div className="flex gap-2">
            <input
              ref={barcodeRef}
              type="text"
              value={barcodeInput}
              onChange={(e) => { setBarcodeInput(e.target.value); setLookupError(null); }}
              onKeyDown={(e) => { if (e.key === "Enter") handleBarcodeSubmit(); }}
              placeholder="バーコードをスキャン または SKU を入力して Enter"
              className={[
                "flex-1 bg-slate-900 border rounded-xl px-4 py-4 text-lg text-white placeholder-slate-600",
                "focus:outline-none focus:ring-2 focus:ring-emerald-500",
                lookupError ? "border-red-500" : "border-slate-600",
              ].join(" ")}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
            />
            <button
              onClick={handleBarcodeSubmit}
              className="px-5 py-4 bg-emerald-700 hover:bg-emerald-600 text-white rounded-xl font-semibold text-lg transition-colors"
            >
              検索
            </button>
          </div>

          {lookupError && (
            <p className="mt-3 text-base text-red-400 font-medium bg-red-900/20 border border-red-700/40 rounded-xl px-4 py-3">
              {lookupError}
            </p>
          )}

          <p className="mt-2 text-xs text-slate-600">
            ※ JAN コード・SKU どちらでも検索できます。iOS では キーボードのカメラアイコンでバーコードスキャンが可能です。
          </p>
        </div>
      )}

      {/* ── Selected product + count input ────────────────────────────────── */}
      {selectedItem && !isReadOnly && (
        <div className="bg-slate-900/80 border-2 border-emerald-600/60 rounded-2xl p-5">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-lg font-bold text-white">{selectedItem.product_name}</p>
              <p className="text-sm text-slate-400 mt-0.5">
                SKU: {selectedItem.sku}
                {selectedItem.barcode && ` | JAN: ${selectedItem.barcode}`}
                {selectedItem.size_label && ` | ${selectedItem.size_label}`}
              </p>
              {selectedItem.status === "counted" && (
                <p className="text-xs text-amber-400 mt-1">
                  ⚠ この商品はすでに計数済みです（{selectedItem.counted_quantity}個）。上書きされます。
                </p>
              )}
            </div>
            <button
              onClick={() => { setSelectedItem(null); setCaseCount(""); setLooseCount(""); focusBarcode(); }}
              className="text-slate-500 hover:text-slate-300 text-xl font-bold leading-none"
            >
              ×
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                ケース数 <span className="text-xs text-slate-500">(×{upc}本/ケース)</span>
              </label>
              <input
                ref={caseRef}
                type="number"
                min="0"
                inputMode="numeric"
                value={caseCount}
                onChange={(e) => setCaseCount(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleSave(); }}
                className="w-full bg-slate-800 border border-slate-600 rounded-xl px-4 py-5 text-3xl font-bold text-white text-center focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                バラ数 <span className="text-xs text-slate-500">(個)</span>
              </label>
              <input
                type="number"
                min="0"
                inputMode="numeric"
                value={looseCount}
                onChange={(e) => setLooseCount(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleSave(); }}
                className="w-full bg-slate-800 border border-slate-600 rounded-xl px-4 py-5 text-3xl font-bold text-white text-center focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div className="bg-slate-800 rounded-xl px-4 py-3 text-center mb-4">
            <span className="text-slate-400 text-sm">合計 </span>
            <span className="text-white text-3xl font-bold">{total}</span>
            <span className="text-slate-400 text-sm"> 個</span>
            <span className="text-slate-500 text-xs ml-2">
              ({cases}ケース × {upc} + {loose}バラ)
            </span>
          </div>

          {saveError && (
            <p className="text-sm text-red-400 mb-3">{saveError}</p>
          )}

          <div className="flex gap-3">
            <button
              onClick={handleSkip}
              disabled={saving}
              className="flex-none px-5 py-4 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-slate-300 text-sm font-medium rounded-xl transition-colors"
            >
              スキップ
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 py-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-lg font-bold rounded-xl transition-colors"
            >
              {saving ? "保存中…" : "保存して次へ →"}
            </button>
          </div>
        </div>
      )}

      {/* ── Tabs: uncounted / counted ──────────────────────────────────────── */}
      <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl overflow-hidden">
        <div className="flex border-b border-slate-700/50">
          <button
            onClick={() => setActiveTab("uncounted")}
            className={[
              "flex-1 py-3 text-sm font-semibold transition-colors",
              activeTab === "uncounted"
                ? "text-amber-400 border-b-2 border-amber-400 bg-amber-900/10"
                : "text-slate-400 hover:text-white",
            ].join(" ")}
          >
            未確認 ({pendingItems.length})
          </button>
          <button
            onClick={() => setActiveTab("counted")}
            className={[
              "flex-1 py-3 text-sm font-semibold transition-colors",
              activeTab === "counted"
                ? "text-green-400 border-b-2 border-green-400 bg-green-900/10"
                : "text-slate-400 hover:text-white",
            ].join(" ")}
          >
            確認済み ({doneCount})
          </button>
        </div>

        {/* Uncounted list */}
        {activeTab === "uncounted" && (
          <div className="divide-y divide-slate-700/30">
            {pendingItems.length === 0 ? (
              <div className="py-10 text-center text-green-400 font-semibold text-sm">
                すべての商品を確認しました！
              </div>
            ) : (
              pendingItems.map((item) => (
                <div
                  key={item.id}
                  onClick={() => {
                    if (isReadOnly) return;
                    setSelectedItem(item);
                    setCaseCount("0");
                    setLooseCount("0");
                    setLookupError(null);
                    setSaveError(null);
                    setTimeout(() => caseRef.current?.focus(), 80);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  className={[
                    "px-4 py-3 flex items-center justify-between",
                    !isReadOnly ? "cursor-pointer hover:bg-slate-700/30" : "",
                  ].join(" ")}
                >
                  <div>
                    <p className="text-sm text-white">{item.product_name}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {item.sku}
                      {item.barcode && ` | ${item.barcode}`}
                      {item.category && ` | ${item.category}`}
                    </p>
                  </div>
                  {item.expected_quantity != null && (
                    <span className="text-xs text-slate-500 ml-3 whitespace-nowrap">
                      予想: {item.expected_quantity}
                    </span>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* Counted list */}
        {activeTab === "counted" && (
          <div className="divide-y divide-slate-700/30">
            {doneCount === 0 ? (
              <div className="py-10 text-center text-slate-500 text-sm">
                まだ確認済み商品はありません
              </div>
            ) : (
              [...countedItems, ...skippedItems]
                .sort((a, b) => (b.counted_at ?? "").localeCompare(a.counted_at ?? ""))
                .map((item) => (
                  <div key={item.id} className="px-4 py-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm text-white">{item.product_name}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{item.sku}</p>
                    </div>
                    <div className="text-right ml-3">
                      {item.status === "skipped" ? (
                        <span className="text-xs text-slate-500 px-2 py-0.5 bg-slate-700 rounded-full">スキップ</span>
                      ) : (
                        <>
                          <p className="text-sm font-bold text-white">
                            {item.case_count}C + {item.loose_count}バラ = <span className="text-emerald-400">{item.counted_quantity}</span>個
                          </p>
                          {item.difference_quantity != null && item.difference_quantity !== 0 && (
                            <p className={`text-xs ${item.difference_quantity > 0 ? "text-blue-400" : "text-red-400"}`}>
                              差分: {item.difference_quantity > 0 ? "+" : ""}{item.difference_quantity}
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                ))
            )}
          </div>
        )}
      </div>

      {/* ── Finalize modal ────────────────────────────────────────────────── */}
      {showFinalizeModal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 w-full max-w-sm">
            {pendingItems.length > 0 ? (
              <>
                <h3 className="text-lg font-bold text-amber-400 mb-2">⚠ 未確認商品があります</h3>
                <p className="text-sm text-slate-300 mb-4">
                  <span className="font-bold text-white">{pendingItems.length} 商品</span>が未確認のまま残っています。
                  棚卸しを完了しますか？
                </p>
                <div className="max-h-36 overflow-y-auto mb-4 space-y-1">
                  {pendingItems.slice(0, 10).map((item) => (
                    <p key={item.id} className="text-xs text-slate-400">• {item.product_name} ({item.sku})</p>
                  ))}
                  {pendingItems.length > 10 && (
                    <p className="text-xs text-slate-500">…他 {pendingItems.length - 10} 商品</p>
                  )}
                </div>
              </>
            ) : (
              <>
                <h3 className="text-lg font-bold text-green-400 mb-2">棚卸しを完了しますか？</h3>
                <p className="text-sm text-slate-300 mb-4">全 {totalCount} 商品の確認が完了しています。</p>
              </>
            )}
            {saveError && <p className="text-sm text-red-400 mb-3">{saveError}</p>}
            <div className="flex gap-3">
              <button
                onClick={() => setShowFinalizeModal(false)}
                className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm font-medium rounded-xl transition-colors"
              >
                戻る
              </button>
              <button
                onClick={handleFinalize}
                disabled={finalizing}
                className="flex-1 py-3 bg-green-700 hover:bg-green-600 disabled:opacity-50 text-white text-sm font-bold rounded-xl transition-colors"
              >
                {finalizing ? "完了中…" : "完了する"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Cancel modal ──────────────────────────────────────────────────── */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 w-full max-w-sm">
            <h3 className="text-lg font-bold text-red-400 mb-2">棚卸しを中止しますか？</h3>
            <p className="text-sm text-slate-300 mb-6">
              このセッションをキャンセルします。入力済みのデータは保存されますが、セッションは「キャンセル」になります。
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowCancelModal(false)}
                className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm font-medium rounded-xl transition-colors"
              >
                戻る
              </button>
              <button
                onClick={handleCancel}
                disabled={finalizing}
                className="flex-1 py-3 bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white text-sm font-bold rounded-xl transition-colors"
              >
                {finalizing ? "中止中…" : "中止する"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
