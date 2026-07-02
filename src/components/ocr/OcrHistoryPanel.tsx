"use client";

// DealerOS — OCR History panel (Phase E9.3). Reuses the existing getOcrHistory
// service (no schema). Read-only list of OCR uploads with source file, date,
// status, confidence, and linked customer/vehicle. Renders safely for missing
// values.

import type { OcrHistoryEntry } from "@/lib/ocr/get-ocr-history";

const STATUS_LABEL: Record<string, string> = {
  pending:    "待機",
  processing: "処理中",
  completed:  "完了",
  failed:     "失敗",
  confirmed:  "確定",
  archived:   "アーカイブ",
};

const STATUS_STYLE: Record<string, string> = {
  completed: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  confirmed: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  failed:    "bg-red-500/15 text-red-400 border-red-500/30",
  processing:"bg-amber-500/15 text-amber-400 border-amber-500/30",
};

export default function OcrHistoryPanel({ entries }: { entries: OcrHistoryEntry[] }) {
  return (
    <div className="max-w-7xl mx-auto mt-6">
      <div className="bg-[#1e293b] rounded-xl shadow-lg p-5">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">OCR履歴</h3>
        {(!entries || entries.length === 0) ? (
          <p className="text-sm text-slate-500 py-4 text-center">OCR履歴はありません</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-700 text-slate-500">
                  <th className="text-left py-2 pr-3">OCR日時</th>
                  <th className="text-left py-2 pr-3">ファイル</th>
                  <th className="text-left py-2 pr-3">ステータス</th>
                  <th className="text-right py-2 pr-3">信頼度</th>
                  <th className="text-left py-2 pr-3">顧客</th>
                  <th className="text-left py-2">車両</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => {
                  const status = e.status ?? "";
                  return (
                    <tr key={e.id} className="border-b border-slate-800/60 last:border-b-0">
                      <td className="py-2 pr-3 text-slate-400 whitespace-nowrap">{e.ocrDate ? e.ocrDate.slice(0, 10) : "—"}</td>
                      <td className="py-2 pr-3 text-slate-200 max-w-[180px] truncate">{e.sourceFile ?? "—"}</td>
                      <td className="py-2 pr-3">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full border ${STATUS_STYLE[status] ?? "bg-slate-700/40 text-slate-300 border-slate-600"}`}>
                          {STATUS_LABEL[status] ?? status ?? "—"}
                        </span>
                      </td>
                      <td className="py-2 pr-3 text-right text-slate-400 whitespace-nowrap">
                        {typeof e.confidence === "number" ? `${Math.round(e.confidence * 100)}%` : "—"}
                      </td>
                      <td className="py-2 pr-3 text-slate-400">{e.linkedCustomer ?? "—"}</td>
                      <td className="py-2 text-slate-400">{e.linkedVehicle ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
