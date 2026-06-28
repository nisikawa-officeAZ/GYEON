"use client";

import { useState } from "react";
import { demoDocuments, DOC_TYPE_LABEL, type DemoDocType } from "@/lib/customer-app/demo-data";

const card = "rounded-2xl border border-white/[.08] bg-[#0f172a]";
const ICON: Record<DemoDocType, string> = { estimate: "📋", invoice: "🧾", completion: "✅" };

type Doc = (typeof demoDocuments)[number];

export default function DocumentsClient() {
  const [filter, setFilter] = useState<DemoDocType | "all">("all");
  const [viewing, setViewing] = useState<Doc | null>(null);

  const list = demoDocuments.filter((d) => filter === "all" || d.type === filter);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-bold text-slate-100">書類</h1>

      {/* Type filter */}
      <div className="flex gap-1.5 flex-wrap">
        {([["all", "すべて"], ["estimate", "見積書"], ["invoice", "請求書"], ["completion", "完了報告書"]] as const).map(([k, label]) => (
          <button key={k} onClick={() => setFilter(k)}
            className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors ${
              filter === k ? "bg-blue-600/20 text-blue-300 border-blue-700/40" : "bg-slate-900 text-slate-400 border-slate-700"
            }`}>{label}</button>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        {list.map((d) => (
          <button key={d.id} onClick={() => setViewing(d)} className={`${card} p-4 flex items-center gap-3 text-left`}>
            <span className="text-xl shrink-0">{ICON[d.type]}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-100">{DOC_TYPE_LABEL[d.type]}</p>
              <p className="text-[10px] text-slate-600">{d.number} ・ {d.date}</p>
            </div>
            {d.total > 0 && <span className="text-xs text-slate-300">¥{d.total.toLocaleString()}</span>}
            <span className="text-slate-600 text-xs">›</span>
          </button>
        ))}
      </div>

      {/* PDF viewer (placeholder) */}
      {viewing && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center" onClick={() => setViewing(null)}>
          <div className="bg-[#0f172a] border border-slate-700 rounded-t-2xl sm:rounded-2xl w-full max-w-md max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
              <p className="text-sm font-semibold text-slate-100">{DOC_TYPE_LABEL[viewing.type]} {viewing.number}</p>
              <button onClick={() => setViewing(null)} className="text-slate-500 text-lg leading-none">×</button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {/* Mock PDF page */}
              <div className="bg-white text-slate-900 rounded-lg p-5 aspect-[1/1.414] shadow-inner flex flex-col">
                <p className="text-[10px] text-slate-400">GYEON Detailer Agent</p>
                <p className="text-base font-bold mt-1">{DOC_TYPE_LABEL[viewing.type]}</p>
                <p className="text-[10px] text-slate-500">{viewing.number} / {viewing.date}</p>
                <div className="border-t border-slate-200 my-3" />
                <div className="space-y-1.5 text-[11px] text-slate-700">
                  <div className="flex justify-between"><span>コーティング施工一式</span><span>¥{(viewing.total || 165000).toLocaleString()}</span></div>
                  <div className="flex justify-between text-slate-400"><span>消費税</span><span>含む</span></div>
                </div>
                <div className="mt-auto border-t border-slate-200 pt-2 flex justify-between font-bold text-slate-900">
                  <span>合計</span><span>¥{(viewing.total || 165000).toLocaleString()}</span>
                </div>
              </div>
              <p className="text-[10px] text-slate-600 text-center mt-3">※ UIデモのプレビューです</p>
            </div>
            <div className="px-4 py-3 border-t border-slate-800">
              <button className="w-full py-2 rounded-lg bg-blue-700 hover:bg-blue-600 text-white text-xs font-semibold">⬇ PDFをダウンロード</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
