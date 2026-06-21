"use client";

// Lazy-loaded section inside WorkOrderDetail.
// Fetches existing completion reports for the work order,
// then shows create form or preview.

import { useState, useEffect, useTransition } from "react";
import {
  CompletionReportDB,
  CompletionReportFullData,
  completionReportDisplayNo,
  completionReportStatusLabel,
} from "@/lib/completion-reports/completion-report-types";
import {
  getCompletionReportsByWorkOrder,
  getCompletionReportFull,
} from "@/lib/completion-reports/get-completion-report";
import CompletionReportForm    from "./CompletionReportForm";
import CompletionReportPreview from "./CompletionReportPreview";

const STATUS_BADGE: Record<string, string> = {
  draft:     "bg-slate-600 text-slate-100",
  generated: "bg-blue-600 text-white",
  shared:    "bg-green-600 text-white",
  archived:  "bg-slate-700 text-slate-400",
};

type ViewState =
  | { mode: "list" }
  | { mode: "create" }
  | { mode: "edit";    report: CompletionReportDB }
  | { mode: "preview"; data: CompletionReportFullData };

interface CompletionReportSectionProps {
  workOrderId: string;
}

export default function CompletionReportSection({ workOrderId }: CompletionReportSectionProps) {
  const [reports,  setReports]  = useState<CompletionReportDB[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [view,     setView]     = useState<ViewState>({ mode: "list" });
  const [pending,  startTransition] = useTransition();

  function refresh() {
    setLoading(true);
    getCompletionReportsByWorkOrder(workOrderId).then((data) => {
      setReports(data);
      setLoading(false);
    });
  }

  useEffect(() => { refresh(); }, [workOrderId]); // eslint-disable-line react-hooks/exhaustive-deps

  function handlePreview(report: CompletionReportDB) {
    startTransition(async () => {
      const fullData = await getCompletionReportFull(report.id);
      if (fullData) {
        setView({ mode: "preview", data: fullData });
      }
    });
  }

  function handleCreated(reportId: string) {
    refresh();
    // Fetch and show preview of the new report
    startTransition(async () => {
      const fullData = await getCompletionReportFull(reportId);
      if (fullData) {
        setView({ mode: "preview", data: fullData });
      } else {
        setView({ mode: "list" });
      }
    });
  }

  // ── Preview view ────────────────────────────────────────────────────────────
  if (view.mode === "preview") {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setView({ mode: "list" })}
            className="text-xs text-slate-400 hover:text-slate-100 flex items-center gap-1 transition-colors"
          >
            ← 一覧に戻る
          </button>
          <button
            onClick={() => window.print()}
            className="text-xs bg-[#1d4ed8] hover:bg-[#1e40af] text-white px-3 py-1.5 rounded-lg transition-colors"
          >
            印刷 / PDF保存
          </button>
        </div>
        <CompletionReportPreview data={view.data} previewAll={true} />
      </div>
    );
  }

  // ── Create form ─────────────────────────────────────────────────────────────
  if (view.mode === "create") {
    return (
      <div className="flex flex-col gap-3">
        <button
          onClick={() => setView({ mode: "list" })}
          className="text-xs text-slate-400 hover:text-slate-100 flex items-center gap-1 transition-colors self-start"
        >
          ← キャンセル
        </button>
        <CompletionReportForm
          workOrderId={workOrderId}
          onCancel={() => setView({ mode: "list" })}
          onSuccess={handleCreated}
        />
      </div>
    );
  }

  // ── Edit form ────────────────────────────────────────────────────────────────
  if (view.mode === "edit") {
    return (
      <div className="flex flex-col gap-3">
        <button
          onClick={() => setView({ mode: "list" })}
          className="text-xs text-slate-400 hover:text-slate-100 flex items-center gap-1 transition-colors self-start"
        >
          ← 戻る
        </button>
        <CompletionReportForm
          workOrderId={workOrderId}
          report={view.report}
          onCancel={() => setView({ mode: "list" })}
          onSuccess={() => { refresh(); setView({ mode: "list" }); }}
        />
      </div>
    );
  }

  // ── List view ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-3">
      {loading ? (
        <p className="text-xs text-slate-500 py-2 text-center">読み込み中...</p>
      ) : reports.length === 0 ? (
        <div className="text-center py-4">
          <p className="text-xs text-slate-600 mb-3">完了報告書がまだありません。</p>
          <button
            onClick={() => setView({ mode: "create" })}
            className="text-sm bg-[#1d4ed8] hover:bg-[#1e40af] text-white px-4 py-2 rounded-lg transition-colors"
          >
            + 完了報告書を作成
          </button>
        </div>
      ) : (
        <>
          <div className="flex justify-end">
            <button
              onClick={() => setView({ mode: "create" })}
              className="text-xs text-[#1d4ed8] hover:text-blue-400 font-medium transition-colors"
            >
              + 新規作成
            </button>
          </div>

          <div className="flex flex-col gap-2">
            {reports.map((r) => (
              <div
                key={r.id}
                className="bg-[#0f172a] border border-slate-700 rounded-lg px-4 py-3 flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-slate-100 truncate">
                      {r.title ?? "施工完了報告書"}
                    </p>
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded shrink-0 ${STATUS_BADGE[r.status] ?? "bg-slate-700 text-slate-300"}`}>
                      {completionReportStatusLabel(r.status)}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    {completionReportDisplayNo(r)}
                    {r.report_date && ` · ${r.report_date}`}
                  </p>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <button
                    onClick={() => setView({ mode: "edit", report: r })}
                    disabled={pending}
                    className="text-xs text-slate-400 hover:text-slate-100 hover:bg-slate-700 px-2 py-1 rounded transition-colors disabled:opacity-50"
                  >
                    編集
                  </button>
                  <button
                    onClick={() => handlePreview(r)}
                    disabled={pending}
                    className="text-xs text-[#1d4ed8] hover:text-blue-400 font-medium px-2 py-1 transition-colors disabled:opacity-50"
                  >
                    {pending ? "..." : "プレビュー"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
