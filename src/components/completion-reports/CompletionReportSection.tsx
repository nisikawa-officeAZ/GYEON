"use client";

// Lazy-loaded section inside WorkOrderDetail (GDA-1W boundary).
//
// There is exactly ONE canonical completion report per work order (§3.1), born
// from the atomic 「作業完了」 flow — this section therefore has no real
// "create" path any more: the empty state explains the completion flow, and
// the form's create mode only resolves an already-existing canonical report.
//
// Work-report (PDF) availability is judged by the SHARED eligibility contract
// via getWorkReportSource (§8): the PDF links appear ONLY when the loader says
// ready, and otherwise the EXACT reasons are displayed — never a vague
// "PDF is preparing" message, and never an estimate-derived substitute.
// The correction form receives the CONFIRMED monetary-free snapshot items and
// the report's version from the same loader; estimate items are never passed.

import { useState, useEffect, useTransition } from "react";
import {
  CompletionReportDB,
  CompletionReportFullData,
  completionReportDisplayNo,
  completionReportStatusLabel,
  type PerformedWorkItemInput,
  type WorkReportNotReadyReason,
} from "@/lib/completion-reports/completion-report-types";
import {
  getCompletionReportsByWorkOrder,
  getCompletionReportFull,
  getWorkReportSource,
} from "@/lib/completion-reports/get-completion-report";
import CompletionReportForm    from "./CompletionReportForm";
import CompletionReportPreview from "./CompletionReportPreview";

const STATUS_BADGE: Record<string, string> = {
  draft:     "bg-slate-600 text-slate-100",
  generated: "bg-blue-600 text-white",
  shared:    "bg-green-600 text-white",
  archived:  "bg-slate-700 text-slate-400",
};

// The exact shared §8 reasons, in operator language. One line per reason —
// the section renders precisely what the eligibility core decided.
const REASON_LABELS: Record<WorkReportNotReadyReason, string> = {
  "unauthenticated":          "ログイン状態を確認してください。",
  "tenant-mismatch":          "報告書・作業指示・顧客・車両の紐付けに不整合があります。",
  "not-canonical":            "この報告書は作業指示の正規の報告書ではありません。",
  "work-order-not-completed": "作業指示が完了していません。「作業完了」操作で完了してください。",
  "missing-report-number":    "報告書番号が未採番です。",
  "missing-report-date":      "報告日が未設定です。",
  "snapshot-unconfirmed":     "実施した作業内容が未確定です。「作業完了」操作で確定してください。",
  "snapshot-empty":           "確定済みの作業内容がありません。",
  "archived":                 "アーカイブ済みの報告書は出力できません。",
};

type ViewState =
  | { mode: "list" }
  | { mode: "create" }
  | {
      mode: "edit";
      report: CompletionReportDB;
      /** Confirmed snapshot rows for the correction form; undefined when unconfirmed. */
      items?: readonly PerformedWorkItemInput[];
      reasons?: readonly WorkReportNotReadyReason[];
    }
  | {
      mode: "preview";
      data: CompletionReportFullData;
      /** null while the shared eligibility judgment is loading. */
      workReport:
        | { ready: true; items: readonly PerformedWorkItemInput[] }
        | { ready: false; reasons: readonly WorkReportNotReadyReason[] }
        | null;
    };

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

  /** Confirmed snapshot rows → the form/preview item shape (monetary-free). */
  function toItemInputs(
    items: ReadonlyArray<{ category: string; item_name: string; description: string | null }>,
  ): PerformedWorkItemInput[] {
    return items.map((i) => ({
      category:    i.category,
      itemName:    i.item_name,
      description: i.description,
    }));
  }

  function handlePreview(report: CompletionReportDB) {
    startTransition(async () => {
      const [fullData, source] = await Promise.all([
        getCompletionReportFull(report.id),
        getWorkReportSource(report.id),
      ]);
      if (!fullData) return;
      setView({
        mode: "preview",
        data: fullData,
        workReport: source.ready
          ? { ready: true, items: toItemInputs(source.data.items) }
          : { ready: false, reasons: source.reasons },
      });
    });
  }

  function handleEdit(report: CompletionReportDB) {
    startTransition(async () => {
      // The correction form needs the CONFIRMED items and version. The shared
      // loader supplies both when the report is work-report ready; otherwise
      // the form's own gating (unconfirmed/non-draft) applies and the exact
      // reasons are shown above it.
      const source = await getWorkReportSource(report.id);
      if (source.ready) {
        setView({ mode: "edit", report, items: toItemInputs(source.data.items) });
      } else {
        setView({ mode: "edit", report, reasons: source.reasons });
      }
    });
  }

  function handleResolved(reportId: string) {
    refresh();
    startTransition(async () => {
      const fullData = await getCompletionReportFull(reportId);
      if (fullData) {
        const source = await getWorkReportSource(reportId);
        setView({
          mode: "preview",
          data: fullData,
          workReport: source.ready
            ? { ready: true, items: toItemInputs(source.data.items) }
            : { ready: false, reasons: source.reasons },
        });
      } else {
        setView({ mode: "list" });
      }
    });
  }

  // ── Preview view ────────────────────────────────────────────────────────────
  if (view.mode === "preview") {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <button
            onClick={() => setView({ mode: "list" })}
            className="text-xs text-slate-400 hover:text-slate-100 flex items-center gap-1 transition-colors"
          >
            ← 一覧に戻る
          </button>
          <div className="flex items-center gap-2 flex-wrap">
            {/* TEMPLATE-C2-WR + GDA-1W §8: the monetary-free 作業内容書 renders
                on demand through the authenticated route. The links appear
                ONLY when the SHARED eligibility contract says ready; the route
                re-judges the same contract and remains the final authority. */}
            {view.workReport?.ready ? (
              <>
                <a
                  href={`/pdf/work-report?reportId=${encodeURIComponent(view.data.report.id)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs bg-[#1d4ed8] hover:bg-[#1e40af] text-white px-3 py-1.5 rounded-lg transition-colors"
                >
                  作業内容書を表示
                </a>
                <a
                  href={`/pdf/work-report?reportId=${encodeURIComponent(view.data.report.id)}&download=1`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs bg-slate-700 hover:bg-slate-600 text-slate-200 px-3 py-1.5 rounded-lg transition-colors"
                >
                  作業内容書をダウンロード
                </a>
              </>
            ) : view.workReport === null ? (
              <p className="text-[11px] text-slate-500">出力可否を確認中...</p>
            ) : null}
          </div>
        </div>

        {/* Exact shared reasons when the work report is not ready. */}
        {view.workReport !== null && !view.workReport.ready && (
          <div className="bg-amber-900/20 border border-amber-800 rounded-lg px-3 py-2">
            <p className="text-[11px] font-medium text-amber-300 mb-1">作業内容書はまだ出力できません:</p>
            <ul className="list-disc list-inside flex flex-col gap-0.5">
              {view.workReport.reasons.map((reason) => (
                <li key={reason} className="text-[11px] text-amber-300/90">
                  {REASON_LABELS[reason]}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Confirmed performed work — the authority the 作業内容書 renders. */}
        {view.workReport?.ready && (
          <div className="bg-[#0f172a] border border-slate-700 rounded-lg px-4 py-3">
            <p className="text-[11px] font-medium text-slate-400 mb-2">確定済みの作業内容</p>
            <ul className="flex flex-col gap-1">
              {view.workReport.items.map((item, index) => (
                <li key={index} className="text-xs text-slate-200">
                  <span className="text-slate-400">{item.category}</span>
                  {" — "}
                  {item.itemName}
                  {item.description && (
                    <span className="text-slate-500">（{item.description}）</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        <CompletionReportPreview data={view.data} previewAll={true} />
      </div>
    );
  }

  // ── Create (guidance/resolve) view ──────────────────────────────────────────
  if (view.mode === "create") {
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
          onCancel={() => setView({ mode: "list" })}
          onSuccess={handleResolved}
        />
      </div>
    );
  }

  // ── Edit (draft correction) view ────────────────────────────────────────────
  if (view.mode === "edit") {
    return (
      <div className="flex flex-col gap-3">
        <button
          onClick={() => setView({ mode: "list" })}
          className="text-xs text-slate-400 hover:text-slate-100 flex items-center gap-1 transition-colors self-start"
        >
          ← 戻る
        </button>
        {view.reasons && (
          <div className="bg-amber-900/20 border border-amber-800 rounded-lg px-3 py-2">
            <ul className="list-disc list-inside flex flex-col gap-0.5">
              {view.reasons.map((reason) => (
                <li key={reason} className="text-[11px] text-amber-300/90">
                  {REASON_LABELS[reason]}
                </li>
              ))}
            </ul>
          </div>
        )}
        <CompletionReportForm
          workOrderId={workOrderId}
          report={view.report}
          initialItems={view.items}
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
          <p className="text-xs text-slate-600 mb-3">
            完了報告書は「作業完了」操作で自動的に作成されます。
          </p>
          <button
            onClick={() => setView({ mode: "create" })}
            className="text-xs text-slate-400 hover:text-slate-100 underline underline-offset-2 transition-colors"
          >
            詳しい案内を見る
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {/* One canonical report per work order — no "new report" button. */}
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
                  {typeof r.performed_work_version === "number" &&
                    r.performed_work_version > 0 &&
                    ` · 版数 ${r.performed_work_version}`}
                </p>
              </div>
              <div className="flex gap-1.5 shrink-0">
                <button
                  onClick={() => handleEdit(r)}
                  disabled={pending}
                  className="text-xs text-slate-400 hover:text-slate-100 hover:bg-slate-700 px-2 py-1 rounded transition-colors disabled:opacity-50"
                >
                  修正
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
      )}
    </div>
  );
}
