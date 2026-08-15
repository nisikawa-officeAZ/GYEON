"use client";

import { useEffect, useState } from "react";

type Status = "unchecked" | "pass" | "fail";
interface ItemState { status: Status; lastChecked: string | null }

const ITEMS: { key: string; label: string; auto?: "aiCenter" | "ocr" }[] = [
  { key: "auth",       label: "認証 (ログイン)" },
  { key: "ai_center",  label: "AIセンター",       auto: "aiCenter" },
  { key: "ocr",        label: "車検証OCR",        auto: "ocr" },
  { key: "customer",   label: "顧客登録" },
  { key: "vehicle",    label: "車両登録" },
  { key: "estimate",   label: "見積作成" },
  { key: "archive",    label: "アーカイブ" },
  { key: "restore",    label: "復元" },
  { key: "hard_delete",label: "完全削除" },
];

const STORAGE_KEY = "gyeon_dev_preview_checklist_v1";

function nowIso(): string {
  return new Date().toISOString();
}
function fmt(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString("ja-JP", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export default function ChecklistClient({ derived }: { derived: { aiCenter: boolean; ocr: boolean } }) {
  const [state, setState] = useState<Record<string, ItemState>>(() =>
    Object.fromEntries(ITEMS.map((i) => [i.key, { status: "unchecked" as Status, lastChecked: null }])),
  );
  const [hydrated, setHydrated] = useState(false);

  // Hydrate from localStorage, then seed auto-derived items if still unchecked.
  useEffect(() => {
    let loaded: Record<string, ItemState> = {};
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) loaded = JSON.parse(raw);
    } catch { /* ignore */ }

    setState((prev) => {
      const next = { ...prev, ...loaded };
      for (const item of ITEMS) {
        if (item.auto && (!next[item.key] || next[item.key].status === "unchecked")) {
          const ok = derived[item.auto];
          next[item.key] = { status: ok ? "pass" : "fail", lastChecked: nowIso() };
        }
      }
      return next;
    });
    setHydrated(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist on change (after hydration).
  useEffect(() => {
    if (!hydrated) return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* ignore */ }
  }, [state, hydrated]);

  function set(key: string, status: Status) {
    setState((prev) => ({ ...prev, [key]: { status, lastChecked: nowIso() } }));
  }

  const passCount = ITEMS.filter((i) => state[i.key]?.status === "pass").length;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-semibold text-slate-100">Developer Preview チェックリスト</h1>
        <p className="text-xs text-slate-500 mt-0.5">
          各項目を確認し PASS / FAIL を記録（この端末に保存）。 {passCount}/{ITEMS.length} PASS
        </p>
      </div>

      <section className="rounded-lg border border-slate-800 bg-[#0b1120] divide-y divide-slate-800/60">
        {ITEMS.map((item) => {
          const st = state[item.key] ?? { status: "unchecked", lastChecked: null };
          return (
            <div key={item.key} className="flex items-center justify-between gap-3 px-4 py-2.5">
              <div className="flex items-center gap-2 min-w-0">
                <span className={`text-sm ${st.status === "pass" ? "text-green-400" : st.status === "fail" ? "text-red-400" : "text-slate-600"}`}>
                  {st.status === "pass" ? "✓" : st.status === "fail" ? "✕" : "—"}
                </span>
                <span className="text-xs text-slate-200 truncate">{item.label}</span>
                {item.auto && <span className="text-[9px] text-slate-600 border border-slate-700 rounded px-1">自動判定</span>}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[10px] text-slate-500 w-24 text-right">{fmt(st.lastChecked)}</span>
                <button
                  type="button"
                  onClick={() => set(item.key, "pass")}
                  className={`text-[11px] px-2 py-1 rounded border ${st.status === "pass" ? "text-green-300 bg-green-900/40 border-green-700/50" : "text-slate-400 border-slate-700 hover:border-slate-500"}`}
                >
                  PASS
                </button>
                <button
                  type="button"
                  onClick={() => set(item.key, "fail")}
                  className={`text-[11px] px-2 py-1 rounded border ${st.status === "fail" ? "text-red-300 bg-red-900/40 border-red-700/50" : "text-slate-400 border-slate-700 hover:border-slate-500"}`}
                >
                  FAIL
                </button>
              </div>
            </div>
          );
        })}
      </section>

      <p className="text-[10px] text-slate-600">
        「自動判定」項目（AIセンター・OCR）はAI検証スナップショットから初期判定されます。手動で上書き可能です。
      </p>
    </div>
  );
}
