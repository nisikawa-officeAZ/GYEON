"use client";

// Full-page Estimate Editor — Phase 2 + Phase 3 (CURRENT_TASK.md §10).
// Sections: customer / vehicle / services / items / discounts / notes / totals.
// Modes: "edit" (prefilled from getEstimate → updateEstimate) and
//        "create" (empty → createEstimate).
//
// Pricing is REUSED, never reimplemented: services build a ServiceInput[] exactly
// like EstimateWizard (L412-434) and generate line items via buildLineItems(); the
// discount + totals use calculateEstimateTotals — the same authoritative functions
// the server uses on persist (§11.2 Functional Parity). No pricing/OCR/PDF change.
//
// §11.1 Unsaved Changes Protection, §11.3 Customer/Vehicle Integrity (select existing
// only — inline creation is Phase 4), and §11.4 Catalog Loading Guard (save blocked
// until the dealer catalog resolves) are honored.

import { useState, useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { EstimateDB, EstimateCategory, estimateDisplayNo } from "@/lib/estimates/estimate-types";
import { CustomerDB, customerDisplayName } from "@/lib/customers/customer-types";
import { VehicleDB, vehicleDisplayName } from "@/lib/vehicles/vehicle-types";
import { updateEstimate } from "@/lib/estimates/update-estimate";
import { createEstimate } from "@/lib/estimates/create-estimate";
import { buildLineItems, type ServiceInput, type PricedLineItem } from "@/lib/pricing/pricing-engine";
import { calculateEstimateTotals, lineTotal } from "@/lib/pricing/estimate-totals";
import { DEFAULT_PRICING_CATALOG, type PricingCatalog } from "@/lib/pricing/pricing-catalog";
import { getDealerPricingCatalog } from "@/lib/pricing/get-dealer-pricing-catalog";

const CATEGORY_LABEL: Record<string, string> = {
  coating: "コーティング", ppf: "PPF", window: "ウィンドウ", interior: "インテリア",
  glass: "ガラス", other: "その他", maintenance: "メンテナンス", carwash: "洗車", roomclean: "ルームクリーニング",
};

const card = "bg-[#1e293b] rounded-xl shadow-lg p-5";
const secHdr = "text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4";
const lbl = "text-xs font-medium text-slate-400";
const inp = "bg-[#0f172a] border border-slate-700 rounded-lg px-3 py-2.5 text-base sm:text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-[#1d4ed8] transition-colors w-full";
const chip = (on: boolean) => `px-3 py-1.5 rounded-lg border text-xs transition-colors ${on ? "bg-blue-950/40 border-[#1d4ed8]/60 text-slate-100" : "bg-[#0f172a] border-slate-700 text-slate-400 hover:border-slate-500"}`;

const DEFAULT_COUPONS = [
  { name: "新規ご来店クーポン",   amount: 5000  },
  { name: "リピーター割引",       amount: 3000  },
  { name: "紹介特典クーポン",     amount: 5000  },
  { name: "キャンペーンクーポン", amount: 10000 },
  { name: "スタッフ割引",         amount: 3000  },
];

function formatYen(n: number) { return "¥" + (n ?? 0).toLocaleString("ja-JP"); }

interface EditorItem {
  key:           string;
  category:      EstimateCategory;
  item_name:     string;
  description:   string;
  quantity:      number;
  unit_price:    number;
  discount_rate: number;
}

// §11.1 — warn before leaving with unsaved changes.
function useUnsavedChangesGuard(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const MSG = "未保存の変更があります。移動してもよろしいですか？";
    const onBeforeUnload = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    const onAnchorClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as HTMLElement | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const href = a.getAttribute("href") ?? "";
      if (href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return;
      if (!window.confirm(MSG)) { e.preventDefault(); e.stopPropagation(); }
    };
    const onPopState = () => {
      if (window.confirm(MSG)) { window.removeEventListener("popstate", onPopState); history.back(); }
      else { history.pushState(history.state, "", window.location.href); }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onAnchorClick, true);
    history.pushState(history.state, "", window.location.href);
    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onAnchorClick, true);
      window.removeEventListener("popstate", onPopState);
    };
  }, [dirty]);
}

interface EstimateEditorProps {
  mode:               "create" | "edit";
  estimate?:          EstimateDB;
  customers:          CustomerDB[];
  vehicles:           VehicleDB[];
  defaultCustomerId?: string;
  defaultVehicleId?:  string;
}

export default function EstimateEditor({ mode, estimate, customers, vehicles, defaultCustomerId, defaultVehicleId }: EstimateEditorProps) {
  const router = useRouter();
  const isEdit = mode === "edit";

  // ── Catalog (client-fetch; §11.4 guard) ────────────────────────────────────
  const [catalog, setCatalog] = useState<PricingCatalog>(DEFAULT_PRICING_CATALOG);
  const [catalogReady, setCatalogReady] = useState(false);
  useEffect(() => {
    let cancelled = false;
    getDealerPricingCatalog()
      .then((c) => { if (!cancelled) { setCatalog(c); setCatalogReady(true); } })
      .catch(() => { if (!cancelled) setCatalogReady(true); });
    return () => { cancelled = true; };
  }, []);

  // ── Customer / Vehicle / Notes ──────────────────────────────────────────────
  const initialCustomerId = estimate?.customer_id ?? defaultCustomerId ?? "";
  const initialVehicleId  = estimate?.vehicle_id ?? defaultVehicleId ?? "";
  const initialNotes      = estimate?.notes ?? "";
  const initialMemo       = estimate?.internal_memo ?? "";

  const [customerId,   setCustomerId]   = useState(initialCustomerId);
  const [vehicleId,    setVehicleId]    = useState(initialVehicleId);
  const [notes,        setNotes]        = useState(initialNotes);
  const [internalMemo, setInternalMemo] = useState(initialMemo);

  // ── Items (editable) ────────────────────────────────────────────────────────
  const keyRef = useRef(0);
  const nextKey = () => `k${keyRef.current++}`;
  const initialItems: EditorItem[] = (estimate?.estimate_items ?? []).map((it) => ({
    key:           it.id,
    category:      it.category,
    item_name:     it.item_name,
    description:   it.description ?? "",
    quantity:      it.quantity,
    unit_price:    it.unit_price,
    discount_rate: it.discount_rate,
  }));
  const [items, setItems] = useState<EditorItem[]>(initialItems);
  const initialItemsSig = useRef(JSON.stringify(initialItems.map((i) => ({ ...i, key: 0 }))));

  // ── Discounts ───────────────────────────────────────────────────────────────
  const [coupons,    setCoupons]    = useState<boolean[]>(DEFAULT_COUPONS.map(() => false));
  // Edit: preserve the saved flat discount by seeding it as the "extra" amount.
  const [extraDisc,  setExtraDisc]  = useState<string>(isEdit ? String(estimate?.discount_amount ?? 0) : "0");
  const [isDealer,   setIsDealer]   = useState(false);
  const [dealerRate, setDealerRate] = useState(70);
  const [taxRate]    = useState<number>(estimate?.tax_rate ?? 10);

  // ── Services selection (build ServiceInput[] like the wizard) ───────────────
  const sizeKeys = catalog.bodySizes.map((b) => b.key);
  const [sizeKey, setSizeKey] = useState<string>(estimate?.vehicles?.body_size ?? "M");
  // coating
  const [coatingId,   setCoatingId]   = useState("");
  const [topcoat2,    setTopcoat2]    = useState("");
  const [topcoat3,    setTopcoat3]    = useState("");
  const [coatingOpts, setCoatingOpts] = useState<string[]>([]);
  // ppf
  const [ppfPlan,       setPpfPlan]       = useState("");
  const [ppfFilm,       setPpfFilm]       = useState("clear");
  const [ppfRank,       setPpfRank]       = useState("std");
  const [ppfFrontGlass, setPpfFrontGlass] = useState("");
  const [ppfParts,      setPpfParts]      = useState<Record<string, number>>({});
  // window
  const [windowParts, setWindowParts] = useState<string[]>([]);
  const [windowGrade, setWindowGrade] = useState("standard");
  // maintenance / carwash
  const [maintSel,   setMaintSel]   = useState<string[]>([]);
  const [carwashSel, setCarwashSel] = useState<string[]>([]);
  // roomclean
  const [roomSel,  setRoomSel]  = useState<string[]>([]);
  const [roomCond, setRoomCond] = useState("normal");
  // other
  const [otherName,  setOtherName]  = useState("");
  const [otherPrice, setOtherPrice] = useState("");

  const [error,   setError]        = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const filteredVehicles = customerId ? vehicles.filter((v) => v.customer_id === customerId) : vehicles;

  // ── Totals (client preview = server-authoritative function) ─────────────────
  const itemsForCalc = items.map((i) => ({ quantity: i.quantity, unit_price: i.unit_price, discount_rate: i.discount_rate }));
  const rawSubtotal  = items.reduce((s, i) => s + lineTotal(i.quantity, i.unit_price, i.discount_rate), 0);
  const couponTotal  = DEFAULT_COUPONS.reduce((s, c, i) => s + (coupons[i] ? c.amount : 0), 0);
  const extraAmount  = Number(extraDisc) || 0;
  const dealerDiscount = isDealer ? Math.round(rawSubtotal * (1 - dealerRate / 100)) : 0;
  const discountAmount = couponTotal + extraAmount + dealerDiscount;
  const totals = calculateEstimateTotals(itemsForCalc, discountAmount, taxRate);

  // ── Dirty tracking (§11.1) ──────────────────────────────────────────────────
  const currentItemsSig = JSON.stringify(items.map((i) => ({ ...i, key: 0 })));
  const dirty =
    customerId !== initialCustomerId ||
    vehicleId  !== initialVehicleId  ||
    notes      !== initialNotes      ||
    internalMemo !== initialMemo     ||
    currentItemsSig !== initialItemsSig.current ||
    couponTotal !== 0 ||
    (isEdit ? extraAmount !== (estimate?.discount_amount ?? 0) : extraAmount !== 0) ||
    isDealer;
  useUnsavedChangesGuard(dirty && !pending);

  // ── Item helpers ────────────────────────────────────────────────────────────
  function appendService(input: ServiceInput) {
    const generated: PricedLineItem[] = buildLineItems([input], catalog);
    if (generated.length === 0) return;
    setItems((prev) => [
      ...prev,
      ...generated.map((g) => ({
        key: nextKey(), category: g.category, item_name: g.item_name,
        description: "", quantity: g.quantity, unit_price: g.unit_price, discount_rate: g.discount_rate,
      })),
    ]);
  }
  function updateItem(key: string, patch: Partial<EditorItem>) {
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, ...patch } : i)));
  }
  function removeItem(key: string) { setItems((prev) => prev.filter((i) => i.key !== key)); }
  function addBlankItem() {
    setItems((prev) => [...prev, { key: nextKey(), category: "other", item_name: "", description: "", quantity: 1, unit_price: 0, discount_rate: 0 }]);
  }
  const toggle = (arr: string[], id: string) => (arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]);

  function handleCancel() {
    if (dirty && !window.confirm("未保存の変更があります。破棄して戻りますか？")) return;
    router.push(isEdit && estimate ? `/estimates/${estimate.id}` : "/estimates");
  }

  function handleSave() {
    setError(null);
    if (!catalogReady) { setError("価格表の読み込み中です。少し待ってから保存してください。"); return; }
    if (!customerId) { setError("顧客を選択してください。"); return; }
    if (!vehicleId)  { setError("車両を選択してください。"); return; }
    if (items.length === 0) { setError("明細を1件以上追加してください。"); return; }

    const itemsPayload = items.map((i, idx) => ({
      category: i.category, item_name: i.item_name, description: i.description,
      quantity: i.quantity, unit_price: i.unit_price, discount_rate: i.discount_rate, sort_order: idx,
    }));

    const fd = new FormData();
    fd.set("customer_id",     customerId);
    fd.set("vehicle_id",      vehicleId);
    fd.set("tax_rate",        String(taxRate));
    fd.set("discount_amount", String(discountAmount));
    fd.set("notes",           notes);
    fd.set("internal_memo",   internalMemo);
    fd.set("subtotal",        String(totals.subtotal));
    fd.set("tax_amount",      String(totals.tax_amount));
    fd.set("total",           String(totals.total));
    fd.set("items_json",      JSON.stringify(itemsPayload));

    startTransition(async () => {
      if (isEdit && estimate) {
        // Preserve status / number / title / valid-until on edit.
        fd.set("status",      String(estimate.status));
        fd.set("estimate_no", estimate.estimate_number ?? estimate.estimate_no ?? "");
        fd.set("title",       estimate.title ?? "");
        fd.set("valid_until", estimate.valid_until ?? "");
        const r = await updateEstimate(estimate.id, fd);
        if ("error" in r) { setError(r.error ?? "保存に失敗しました。"); return; }
        router.push(`/estimates/${estimate.id}`);
      } else {
        fd.set("status", "draft"); // new estimates are drafts
        const r = await createEstimate(fd);
        if (r?.error) { setError(r.error); return; }
        const newId = "estimateId" in r ? r.estimateId : undefined;
        router.push(newId ? `/estimates/${newId}` : "/estimates");
      }
    });
  }

  return (
    <div className="flex flex-col gap-4 pb-24 sm:pb-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold text-slate-100">{isEdit ? "見積編集" : "新規見積"}</h1>
          {isEdit && estimate && (
            <p className="text-xs text-slate-500 mt-0.5">{estimateDisplayNo(estimate)}{estimate.title ? ` / ${estimate.title}` : ""}</p>
          )}
        </div>
        <div className="hidden sm:flex items-center gap-2">
          <button type="button" onClick={handleCancel} disabled={pending}
            className="text-xs font-medium bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-slate-200 px-4 py-2 rounded-lg transition-colors">キャンセル</button>
          <button type="button" onClick={handleSave} disabled={pending || !catalogReady}
            className="text-xs font-medium bg-[#1d4ed8] hover:bg-[#1e40af] disabled:opacity-50 text-white px-4 py-2 rounded-lg transition-colors">
            {pending ? "保存中..." : "保存"}</button>
        </div>
      </div>

      {!catalogReady && <p className="text-[11px] text-amber-400">価格表を読み込み中... 読み込み完了まで保存できません。</p>}
      {error && (
        <div className="px-3 py-2 rounded-lg border border-red-500/30 bg-red-500/10"><p className="text-xs text-red-400">{error}</p></div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 flex flex-col gap-4">
          {/* Customer */}
          <div className={card}>
            <h3 className={secHdr}>顧客</h3>
            <label className={lbl}>顧客を選択</label>
            <select value={customerId} onChange={(e) => { setCustomerId(e.target.value); setVehicleId(""); }} className={`${inp} mt-1`}>
              <option value="">顧客を選択...</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{customerDisplayName(c) || c.last_name || "（無名）"}</option>)}
            </select>
          </div>

          {/* Vehicle */}
          <div className={card}>
            <h3 className={secHdr}>車両</h3>
            <label className={lbl}>車両を選択</label>
            <select value={vehicleId} onChange={(e) => setVehicleId(e.target.value)} className={`${inp} mt-1`}>
              <option value="">車両を選択...</option>
              {filteredVehicles.map((v) => <option key={v.id} value={v.id}>{vehicleDisplayName(v) || "（車両）"}</option>)}
            </select>
            {customerId && filteredVehicles.length === 0 && <p className="text-[10px] text-slate-500 mt-1.5">この顧客に紐づく車両がありません。</p>}
          </div>

          {/* Services */}
          <div className={card}>
            <h3 className={secHdr}>サービス（明細生成）</h3>
            <p className="text-[10px] text-slate-500 mb-3">カテゴリを設定し「明細に追加」で価格表から明細を生成します。生成後は下の明細で数量・割引を調整できます。</p>

            <div className="flex items-center gap-2 mb-4">
              <span className={lbl}>ボディサイズ</span>
              <select value={sizeKey} onChange={(e) => setSizeKey(e.target.value)} className="bg-[#0f172a] border border-slate-700 rounded px-2 py-1 text-sm text-slate-100">
                {sizeKeys.map((k) => <option key={k} value={k}>{k}</option>)}
              </select>
            </div>

            <div className="flex flex-col gap-4">
              {/* Coating */}
              <div className="border border-slate-700/60 rounded-lg p-3">
                <p className="text-xs font-semibold text-blue-300 mb-2">コーティング</p>
                <select value={coatingId} onChange={(e) => setCoatingId(e.target.value)} className={`${inp} mb-2`}>
                  <option value="">コーティングを選択...</option>
                  {catalog.coatings.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <select value={topcoat2} onChange={(e) => setTopcoat2(e.target.value)} className={inp}>
                    <option value="">トップコート2層目なし</option>
                    {Object.keys(catalog.topcoatBase).map((t) => <option key={t} value={t}>{catalog.topcoatName[t] ?? t}</option>)}
                  </select>
                  <select value={topcoat3} onChange={(e) => setTopcoat3(e.target.value)} className={inp}>
                    <option value="">トップコート3層目なし</option>
                    {Object.keys(catalog.topcoatBase).map((t) => <option key={t} value={t}>{catalog.topcoatName[t] ?? t}</option>)}
                  </select>
                </div>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {catalog.coatingOptions.filter((o) => o.cat === "coating").map((o) => (
                    <button key={o.id} type="button" onClick={() => setCoatingOpts((p) => toggle(p, o.id))} className={chip(coatingOpts.includes(o.id))}>{o.name}</button>
                  ))}
                </div>
                <button type="button" disabled={!coatingId} onClick={() => appendService({ type: "coating", coatingId, sizeKey, topcoat2: topcoat2 || undefined, topcoat3: topcoat3 || undefined, optionIds: coatingOpts })}
                  className="text-xs text-blue-400 border border-blue-500/30 bg-blue-500/5 hover:bg-blue-500/10 disabled:opacity-40 px-3 py-1.5 rounded-lg">明細に追加</button>
              </div>

              {/* PPF */}
              <div className="border border-slate-700/60 rounded-lg p-3">
                <p className="text-xs font-semibold text-blue-300 mb-2">PPF</p>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <select value={ppfPlan} onChange={(e) => setPpfPlan(e.target.value)} className={inp}>
                    <option value="">プランを選択...</option>
                    {catalog.ppfPlans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <select value={ppfFilm} onChange={(e) => setPpfFilm(e.target.value)} className={inp}>
                    {catalog.ppfFilmTypes.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                  </select>
                  <select value={ppfRank} onChange={(e) => setPpfRank(e.target.value)} className={inp}>
                    {catalog.ppfVehicleRanks.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                  <select value={ppfFrontGlass} onChange={(e) => setPpfFrontGlass(e.target.value)} className={inp}>
                    <option value="">フロントガラスなし</option>
                    {catalog.ppfFrontGlass.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                </div>
                {catalog.ppfSingleParts.length > 0 && (
                  <div className="flex flex-col gap-1 mb-2">
                    {catalog.ppfSingleParts.map((sp) => (
                      <div key={sp.id} className="flex items-center gap-2 text-xs text-slate-300">
                        <span className="flex-1">{sp.name}</span>
                        <input type="number" min={0} max={sp.maxQty} value={ppfParts[sp.id] ?? 0}
                          onChange={(e) => setPpfParts((p) => ({ ...p, [sp.id]: Math.max(0, Math.min(sp.maxQty, Number(e.target.value) || 0)) }))}
                          className="w-16 bg-[#0f172a] border border-slate-700 rounded px-2 py-1 text-slate-100" />
                      </div>
                    ))}
                  </div>
                )}
                <button type="button" disabled={!ppfPlan} onClick={() => appendService({ type: "ppf", planId: ppfPlan, filmType: ppfFilm, vehicleRank: ppfRank, sizeKey, frontGlass: ppfFrontGlass || undefined, singleParts: Object.entries(ppfParts).filter(([, q]) => q > 0).map(([id, qty]) => ({ id, qty })) })}
                  className="text-xs text-blue-400 border border-blue-500/30 bg-blue-500/5 hover:bg-blue-500/10 disabled:opacity-40 px-3 py-1.5 rounded-lg">明細に追加</button>
              </div>

              {/* Window */}
              <div className="border border-slate-700/60 rounded-lg p-3">
                <p className="text-xs font-semibold text-blue-300 mb-2">ウィンドウフィルム</p>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {catalog.windowParts.map((p) => <button key={p.id} type="button" onClick={() => setWindowParts((x) => toggle(x, p.id))} className={chip(windowParts.includes(p.id))}>{p.name}</button>)}
                </div>
                <select value={windowGrade} onChange={(e) => setWindowGrade(e.target.value)} className={`${inp} mb-2`}>
                  {catalog.windowGrades.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
                <button type="button" disabled={windowParts.length === 0} onClick={() => appendService({ type: "window", partIds: windowParts, grade: windowGrade })}
                  className="text-xs text-blue-400 border border-blue-500/30 bg-blue-500/5 hover:bg-blue-500/10 disabled:opacity-40 px-3 py-1.5 rounded-lg">明細に追加</button>
              </div>

              {/* Maintenance */}
              <div className="border border-slate-700/60 rounded-lg p-3">
                <p className="text-xs font-semibold text-blue-300 mb-2">ボディ定期メンテナンス</p>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {catalog.maintenanceMenus.map((m) => <button key={m.id} type="button" onClick={() => setMaintSel((x) => toggle(x, m.id))} className={chip(maintSel.includes(m.id))}>{m.name}</button>)}
                </div>
                <button type="button" disabled={maintSel.length === 0} onClick={() => appendService({ type: "maintenance", menuIds: maintSel })}
                  className="text-xs text-blue-400 border border-blue-500/30 bg-blue-500/5 hover:bg-blue-500/10 disabled:opacity-40 px-3 py-1.5 rounded-lg">明細に追加</button>
              </div>

              {/* Carwash */}
              <div className="border border-slate-700/60 rounded-lg p-3">
                <p className="text-xs font-semibold text-blue-300 mb-2">メンテナンス洗車</p>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {catalog.carwashMenus.map((m) => <button key={m.id} type="button" onClick={() => setCarwashSel((x) => toggle(x, m.id))} className={chip(carwashSel.includes(m.id))}>{m.name}</button>)}
                </div>
                <button type="button" disabled={carwashSel.length === 0} onClick={() => appendService({ type: "carwash", menuIds: carwashSel })}
                  className="text-xs text-blue-400 border border-blue-500/30 bg-blue-500/5 hover:bg-blue-500/10 disabled:opacity-40 px-3 py-1.5 rounded-lg">明細に追加</button>
              </div>

              {/* Room clean */}
              <div className="border border-slate-700/60 rounded-lg p-3">
                <p className="text-xs font-semibold text-blue-300 mb-2">ルームクリーニング</p>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {catalog.roomCleanParts.map((p) => <button key={p.id} type="button" onClick={() => setRoomSel((x) => toggle(x, p.id))} className={chip(roomSel.includes(p.id))}>{p.name}</button>)}
                </div>
                <select value={roomCond} onChange={(e) => setRoomCond(e.target.value)} className={`${inp} mb-2`}>
                  {catalog.roomCleanConditions.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
                <button type="button" disabled={roomSel.length === 0} onClick={() => appendService({ type: "roomclean", partIds: roomSel, condition: roomCond })}
                  className="text-xs text-blue-400 border border-blue-500/30 bg-blue-500/5 hover:bg-blue-500/10 disabled:opacity-40 px-3 py-1.5 rounded-lg">明細に追加</button>
              </div>

              {/* Other */}
              <div className="border border-slate-700/60 rounded-lg p-3">
                <p className="text-xs font-semibold text-blue-300 mb-2">その他作業</p>
                <div className="flex gap-2 mb-2">
                  <input type="text" value={otherName} onChange={(e) => setOtherName(e.target.value)} placeholder="項目名" className={inp} />
                  <input type="number" value={otherPrice} onChange={(e) => setOtherPrice(e.target.value)} placeholder="金額" className="w-28 bg-[#0f172a] border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-100" />
                </div>
                <button type="button" disabled={!otherName.trim() || !(Number(otherPrice) > 0)}
                  onClick={() => { appendService({ type: "other", items: [{ name: otherName.trim(), price: Number(otherPrice) || 0 }] }); setOtherName(""); setOtherPrice(""); }}
                  className="text-xs text-blue-400 border border-blue-500/30 bg-blue-500/5 hover:bg-blue-500/10 disabled:opacity-40 px-3 py-1.5 rounded-lg">明細に追加</button>
              </div>
            </div>
          </div>

          {/* Items */}
          <div className={card}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">明細</h3>
              <button type="button" onClick={addBlankItem} className="text-xs text-blue-400 hover:text-blue-300">＋ 行を追加</button>
            </div>
            {items.length === 0 ? (
              <p className="text-xs text-slate-600">明細がありません。上のサービスから追加するか「＋ 行を追加」で手入力してください。</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-700 text-slate-500">
                      <th className="text-left pb-2 pr-2">カテゴリ</th>
                      <th className="text-left pb-2 pr-2">品目</th>
                      <th className="text-right pb-2 pr-2">単価</th>
                      <th className="text-right pb-2 pr-2">数量</th>
                      <th className="text-right pb-2 pr-2">割引%</th>
                      <th className="text-right pb-2 pr-2">小計</th>
                      <th className="pb-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((it) => (
                      <tr key={it.key} className="border-b border-slate-700/40 last:border-b-0">
                        <td className="py-1.5 pr-2 text-slate-500 whitespace-nowrap">{CATEGORY_LABEL[it.category] ?? it.category}</td>
                        <td className="py-1.5 pr-2">
                          <input type="text" value={it.item_name} onChange={(e) => updateItem(it.key, { item_name: e.target.value })} className="w-40 bg-[#0f172a] border border-slate-700 rounded px-2 py-1 text-slate-200" />
                        </td>
                        <td className="py-1.5 pr-2 text-right">
                          <input type="number" value={it.unit_price} onChange={(e) => updateItem(it.key, { unit_price: Number(e.target.value) || 0 })} className="w-24 bg-[#0f172a] border border-slate-700 rounded px-2 py-1 text-right text-slate-200" />
                        </td>
                        <td className="py-1.5 pr-2 text-right">
                          <input type="number" min={0} value={it.quantity} onChange={(e) => updateItem(it.key, { quantity: Number(e.target.value) || 0 })} className="w-16 bg-[#0f172a] border border-slate-700 rounded px-2 py-1 text-right text-slate-200" />
                        </td>
                        <td className="py-1.5 pr-2 text-right">
                          <input type="number" min={0} max={100} value={it.discount_rate} onChange={(e) => updateItem(it.key, { discount_rate: Number(e.target.value) || 0 })} className="w-16 bg-[#0f172a] border border-slate-700 rounded px-2 py-1 text-right text-slate-200" />
                        </td>
                        <td className="py-1.5 pr-2 text-right text-slate-200 whitespace-nowrap">{formatYen(lineTotal(it.quantity, it.unit_price, it.discount_rate))}</td>
                        <td className="py-1.5 text-right">
                          <button type="button" onClick={() => removeItem(it.key)} className="text-slate-500 hover:text-red-400">✕</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Discounts */}
          <div className={card}>
            <h3 className={secHdr}>値引き</h3>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {DEFAULT_COUPONS.map((c, i) => (
                <button key={c.name} type="button" onClick={() => setCoupons((p) => p.map((v, j) => (j === i ? !v : v)))} className={chip(coupons[i])}>
                  {c.name}（{formatYen(c.amount)}）
                </button>
              ))}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={lbl}>その他値引き（円）</label>
                <input type="number" value={extraDisc} onChange={(e) => setExtraDisc(e.target.value)} className={`${inp} mt-1`} />
              </div>
              <div>
                <label className={lbl}>業販</label>
                <div className="flex items-center gap-2 mt-1">
                  <button type="button" onClick={() => setIsDealer((v) => !v)} className={`w-5 h-5 rounded border-2 flex items-center justify-center ${isDealer ? "bg-[#1d4ed8] border-[#1d4ed8]" : "border-slate-600"}`}>{isDealer && <span className="text-white text-[10px]">✓</span>}</button>
                  {isDealer && (
                    <><input type="number" min={0} max={100} value={dealerRate} onChange={(e) => setDealerRate(Number(e.target.value) || 0)} className="w-16 bg-[#0f172a] border border-slate-700 rounded px-2 py-1 text-sm text-slate-100" /><span className="text-slate-400 text-sm">%</span></>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className={card}>
            <h3 className={secHdr}>備考・メモ</h3>
            <label className={lbl}>お客様向け備考</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="見積書に記載する備考..." className={`${inp} mt-1 mb-3 resize-y`} />
            <label className={lbl}>社内メモ</label>
            <textarea value={internalMemo} onChange={(e) => setInternalMemo(e.target.value)} rows={3} placeholder="社内向けメモ（見積書には出ません）..." className={`${inp} mt-1 resize-y`} />
          </div>
        </div>

        {/* Totals */}
        <div className="lg:col-span-1">
          <div className={`${card} lg:sticky lg:top-4`}>
            <h3 className={secHdr}>合計</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-slate-400">小計</span><span className="text-slate-200">{formatYen(totals.subtotal)}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">値引き</span><span className="text-slate-200">-{formatYen(totals.discount_amount)}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">消費税（{taxRate}%）</span><span className="text-slate-200">{formatYen(totals.tax_amount)}</span></div>
              <div className="flex justify-between border-t border-slate-700 pt-2 font-semibold"><span className="text-slate-200">合計</span><span className="text-white">{formatYen(totals.total)}</span></div>
            </div>
            <p className="text-[10px] text-slate-600 mt-3">金額は保存時にサーバーで再計算され確定します。</p>
          </div>
        </div>
      </div>

      {/* Mobile sticky bar */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 z-40 flex gap-2 p-3 bg-[#0f172a]/95 backdrop-blur border-t border-slate-800">
        <button type="button" onClick={handleCancel} disabled={pending} className="flex-1 text-sm font-medium bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-slate-200 px-4 py-3 rounded-lg">キャンセル</button>
        <button type="button" onClick={handleSave} disabled={pending || !catalogReady} className="flex-1 text-sm font-medium bg-[#1d4ed8] hover:bg-[#1e40af] disabled:opacity-50 text-white px-4 py-3 rounded-lg">{pending ? "保存中..." : "保存"}</button>
      </div>
    </div>
  );
}
