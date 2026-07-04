"use client";

// Full-page Estimate Editor — Phase 2 (CURRENT_TASK.md §10).
// Scope: the shared editor SHELL + sections { customer, vehicle, notes, totals }
// in EDIT mode, prefilled from getEstimate and wired to updateEstimate.
//
// NOT in Phase 2 (deferred to Phase 3): services / items / discounts editing, and
// create mode (/estimates/new). Existing line items, status, estimate no, title,
// valid-until and totals are PRESERVED on save (no items_json sent → items untouched;
// current totals/status round-tripped) so editing customer/vehicle/notes never
// wipes pricing (reuses updateEstimate verbatim — no pricing/OCR/PDF change).
//
// §11.1 Unsaved Changes Protection and §11.3 Customer/Vehicle Integrity are honored.

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { EstimateDB, estimateDisplayNo } from "@/lib/estimates/estimate-types";
import { CustomerDB, customerDisplayName } from "@/lib/customers/customer-types";
import { VehicleDB, vehicleDisplayName } from "@/lib/vehicles/vehicle-types";
import { updateEstimate } from "@/lib/estimates/update-estimate";

const card = "bg-[#1e293b] rounded-xl shadow-lg p-5";
const secHdr = "text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4";
const lbl = "text-xs font-medium text-slate-400";
const inp = "bg-[#0f172a] border border-slate-700 rounded-lg px-3 py-2.5 text-base sm:text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-[#1d4ed8] transition-colors w-full";

function formatYen(n: number) {
  return "¥" + (n ?? 0).toLocaleString("ja-JP");
}

// §11.1 — warn before leaving with unsaved changes (reload/close/external, in-app
// link clicks, and browser back/forward). Programmatic router.push (Save/Cancel) is
// not intercepted, so those intentional navigations proceed.
function useUnsavedChangesGuard(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const MSG = "未保存の変更があります。移動してもよろしいですか？";

    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    const onAnchorClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as HTMLElement | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const href = a.getAttribute("href") ?? "";
      if (href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return;
      if (!window.confirm(MSG)) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    const onPopState = () => {
      if (window.confirm(MSG)) {
        window.removeEventListener("popstate", onPopState);
        history.back();
      } else {
        history.pushState(history.state, "", window.location.href);
      }
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onAnchorClick, true);
    history.pushState(history.state, "", window.location.href); // seed for back-guard
    window.addEventListener("popstate", onPopState);

    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onAnchorClick, true);
      window.removeEventListener("popstate", onPopState);
    };
  }, [dirty]);
}

interface EstimateEditorProps {
  mode:      "edit"; // "create" added in Phase 3
  estimate:  EstimateDB;
  customers: CustomerDB[];
  vehicles:  VehicleDB[];
}

export default function EstimateEditor({ estimate, customers, vehicles }: EstimateEditorProps) {
  const router = useRouter();

  const initialCustomerId  = estimate.customer_id ?? "";
  const initialVehicleId   = estimate.vehicle_id ?? "";
  const initialNotes       = estimate.notes ?? "";
  const initialMemo        = estimate.internal_memo ?? "";

  const [customerId,   setCustomerId]   = useState(initialCustomerId);
  const [vehicleId,    setVehicleId]    = useState(initialVehicleId);
  const [notes,        setNotes]        = useState(initialNotes);
  const [internalMemo, setInternalMemo] = useState(initialMemo);
  const [error,        setError]        = useState<string | null>(null);
  const [pending, startTransition]      = useTransition();

  // Vehicles are scoped to the selected customer (matches the existing edit form).
  const filteredVehicles = customerId
    ? vehicles.filter((v) => v.customer_id === customerId)
    : vehicles;

  const dirty =
    customerId !== initialCustomerId ||
    vehicleId  !== initialVehicleId  ||
    notes      !== initialNotes      ||
    internalMemo !== initialMemo;

  useUnsavedChangesGuard(dirty && !pending);

  function handleCancel() {
    if (dirty && !window.confirm("未保存の変更があります。破棄して戻りますか？")) return;
    router.push(`/estimates/${estimate.id}`);
  }

  function handleSave() {
    setError(null);
    if (!customerId) { setError("顧客を選択してください。"); return; }
    if (!vehicleId)  { setError("車両を選択してください。"); return; }

    const fd = new FormData();
    // Edited fields
    fd.set("customer_id",   customerId);
    fd.set("vehicle_id",    vehicleId);
    fd.set("notes",         notes);
    fd.set("internal_memo", internalMemo);
    // Preserved fields (round-tripped so nothing is reset). NO items_json → line
    // items are left untouched by updateEstimate.
    fd.set("estimate_no",     estimate.estimate_number ?? estimate.estimate_no ?? "");
    fd.set("status",          String(estimate.status));
    fd.set("title",           estimate.title ?? "");
    fd.set("subtotal",        String(estimate.subtotal ?? 0));
    fd.set("tax_rate",        String(estimate.tax_rate ?? 10));
    fd.set("tax_amount",      String(estimate.tax_amount ?? estimate.tax ?? 0));
    fd.set("discount_amount", String(estimate.discount_amount ?? 0));
    fd.set("total",           String(estimate.total ?? 0));
    fd.set("valid_until",     estimate.valid_until ?? "");

    startTransition(async () => {
      const result = await updateEstimate(estimate.id, fd);
      if ("error" in result) { setError(result.error ?? "保存に失敗しました。"); return; }
      router.push(`/estimates/${estimate.id}`);
    });
  }

  const taxAmount = estimate.tax_amount ?? estimate.tax ?? 0;

  return (
    <div className="flex flex-col gap-4 pb-24 sm:pb-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold text-slate-100">見積編集</h1>
          <p className="text-xs text-slate-500 mt-0.5">{estimateDisplayNo(estimate)}{estimate.title ? ` / ${estimate.title}` : ""}</p>
        </div>
        <div className="hidden sm:flex items-center gap-2">
          <button type="button" onClick={handleCancel} disabled={pending}
            className="text-xs font-medium bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-slate-200 px-4 py-2 rounded-lg transition-colors">
            キャンセル
          </button>
          <button type="button" onClick={handleSave} disabled={pending}
            className="text-xs font-medium bg-[#1d4ed8] hover:bg-[#1e40af] disabled:opacity-50 text-white px-4 py-2 rounded-lg transition-colors">
            {pending ? "保存中..." : "保存"}
          </button>
        </div>
      </div>

      {error && (
        <div className="px-3 py-2 rounded-lg border border-red-500/30 bg-red-500/10">
          <p className="text-xs text-red-400">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: editable sections */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          {/* Customer */}
          <div className={card}>
            <h3 className={secHdr}>顧客</h3>
            <label className={lbl}>顧客を選択</label>
            <select
              value={customerId}
              onChange={(e) => { setCustomerId(e.target.value); setVehicleId(""); }}
              className={`${inp} mt-1`}
            >
              <option value="">顧客を選択...</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {customerDisplayName(c) || c.last_name || "（無名）"}
                </option>
              ))}
            </select>
          </div>

          {/* Vehicle */}
          <div className={card}>
            <h3 className={secHdr}>車両</h3>
            <label className={lbl}>車両を選択</label>
            <select
              value={vehicleId}
              onChange={(e) => setVehicleId(e.target.value)}
              className={`${inp} mt-1`}
            >
              <option value="">車両を選択...</option>
              {filteredVehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {vehicleDisplayName(v) || "（車両）"}
                </option>
              ))}
            </select>
            {customerId && filteredVehicles.length === 0 && (
              <p className="text-[10px] text-slate-500 mt-1.5">この顧客に紐づく車両がありません。</p>
            )}
          </div>

          {/* Notes */}
          <div className={card}>
            <h3 className={secHdr}>備考・メモ</h3>
            <label className={lbl}>お客様向け備考</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="見積書に記載する備考..."
              className={`${inp} mt-1 mb-3 resize-y`}
            />
            <label className={lbl}>社内メモ</label>
            <textarea
              value={internalMemo}
              onChange={(e) => setInternalMemo(e.target.value)}
              rows={3}
              placeholder="社内向けメモ（見積書には出ません）..."
              className={`${inp} mt-1 resize-y`}
            />
          </div>
        </div>

        {/* Right: totals (read-only in Phase 2 — services/items are Phase 3) */}
        <div className="lg:col-span-1">
          <div className={`${card} lg:sticky lg:top-4`}>
            <h3 className={secHdr}>合計</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-slate-400">小計</span><span className="text-slate-200">{formatYen(estimate.subtotal ?? 0)}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">値引き</span><span className="text-slate-200">{formatYen(estimate.discount_amount ?? 0)}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">消費税（{estimate.tax_rate ?? 10}%）</span><span className="text-slate-200">{formatYen(taxAmount)}</span></div>
              <div className="flex justify-between border-t border-slate-700 pt-2 font-semibold"><span className="text-slate-200">合計</span><span className="text-white">{formatYen(estimate.total ?? 0)}</span></div>
            </div>
            <p className="text-[10px] text-slate-600 mt-3">
              サービス・明細・値引きの編集は次フェーズで対応します。現在は顧客・車両・備考のみ編集可能で、明細と金額は保持されます。
            </p>
          </div>
        </div>
      </div>

      {/* Mobile sticky action bar */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 z-40 flex gap-2 p-3 bg-[#0f172a]/95 backdrop-blur border-t border-slate-800">
        <button type="button" onClick={handleCancel} disabled={pending}
          className="flex-1 text-sm font-medium bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-slate-200 px-4 py-3 rounded-lg transition-colors">
          キャンセル
        </button>
        <button type="button" onClick={handleSave} disabled={pending}
          className="flex-1 text-sm font-medium bg-[#1d4ed8] hover:bg-[#1e40af] disabled:opacity-50 text-white px-4 py-3 rounded-lg transition-colors">
          {pending ? "保存中..." : "保存"}
        </button>
      </div>
    </div>
  );
}
