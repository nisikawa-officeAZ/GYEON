"use client";

// Co-located pure helpers for the Estimate module (extracted from EstimateEditor.tsx
// during the pre-integration refactor). Everything here was moved VERBATIM — no value,
// label, style, coupon amount, or behaviour change. The purpose is only to separate
// presentation-independent constants / helpers / the unsaved-changes hook so they can
// be reused by the upcoming wizard shell without touching pricing, OCR, or save logic.

import { useEffect } from "react";
import type { EstimateCategory } from "@/lib/estimates/estimate-types";

// Line-item category display labels used by the 明細 table and 合計 breakdown.
// NOTE: intentionally distinct from the service SELECTION labels in
// src/lib/estimates/service-categories.ts (SERVICE_CATEGORIES uses longer wording
// such as "ボディコーティング"). These short labels must NOT be merged with that
// module — doing so would change on-screen text. Keep as-is.
export const CATEGORY_LABEL: Record<string, string> = {
  coating: "コーティング", ppf: "PPF", window: "ウィンドウ", interior: "インテリア",
  glass: "ガラス", other: "その他", maintenance: "メンテナンス", carwash: "洗車", roomclean: "ルームクリーニング",
};

// PPF partial parts that require an operator-entered quantity (>=1). All other
// single parts are treated as quantity = 1 internally. UI-only classification —
// does NOT modify the PPF price master (pricing-data.ts) or dealer settings.
export const PPF_QTY_REQUIRED = new Set<string>(["sp-step", "sp-door-cup"]);

// Shared Tailwind class tokens for the current editor UI.
export const card = "bg-[#1e293b] rounded-xl shadow-lg p-5";
export const secHdr = "text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4";
export const lbl = "text-xs font-medium text-slate-400";
export const inp = "bg-[#0f172a] border border-slate-700 rounded-lg px-3 py-2.5 text-base sm:text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-[#1d4ed8] transition-colors w-full";
export const chip = (on: boolean) => `px-3 py-1.5 rounded-lg border text-xs transition-colors ${on ? "bg-blue-950/40 border-[#1d4ed8]/60 text-slate-100" : "bg-[#0f172a] border-slate-700 text-slate-400 hover:border-slate-500"}`;

// Default coupon set. Values mirror DEFAULT_COUPON_SETTINGS in
// src/lib/dealer-settings/dealer-settings-defaults.ts (kept identical). Consolidating
// the two into one source is a separate, reviewed step — not done here to avoid any
// coupling change during this behaviour-preserving refactor.
export const DEFAULT_COUPONS = [
  { name: "新規ご来店クーポン",   amount: 5000  },
  { name: "リピーター割引",       amount: 3000  },
  { name: "紹介特典クーポン",     amount: 5000  },
  { name: "キャンペーンクーポン", amount: 10000 },
  { name: "スタッフ割引",         amount: 3000  },
];

export function formatYen(n: number) { return "¥" + (n ?? 0).toLocaleString("ja-JP"); }

// Editable line-item row model used by the editor's items table.
export interface EditorItem {
  key:           string;
  category:      EstimateCategory;
  item_name:     string;
  description:   string;
  quantity:      number;
  unit_price:    number;
  discount_rate: number;
}

// §11.1 — warn before leaving with unsaved changes.
export function useUnsavedChangesGuard(dirty: boolean) {
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
