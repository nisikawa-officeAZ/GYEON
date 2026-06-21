"use client";

// PHASE62: Staging issue panel.
// Create and manage staging verification issues.
// No deploy, no SQL, no migration apply.

import { useState, useTransition } from "react";
import {
  StagingIssue,
  IssueSeverity,
  IssueStatus,
  issueSeverityLabel,
  issueStatusLabel,
  issueSeverityColor,
} from "@/lib/staging-verification/checklist";
import {
  createStagingIssue,
  updateStagingIssue,
} from "@/lib/staging-verification/staging-verification";

interface Props {
  issues:    StagingIssue[];
  runId?:    string;
  onRefresh: () => void;
}

const SEVERITY_OPTIONS: IssueSeverity[] = ["critical", "high", "medium", "low"];
const STATUS_OPTIONS: IssueStatus[]     = ["open", "investigating", "resolved", "wont_fix"];

function IssueRow({ issue, onRefresh }: { issue: StagingIssue; onRefresh: () => void }) {
  const [expanded,   setExpanded]   = useState(false);
  const [status,     setStatus]     = useState<IssueStatus>(issue.status);
  const [resNote,    setResNote]    = useState(issue.resolution_note ?? "");
  const [isPending,  startTransition] = useTransition();
  const [error,      setError]      = useState<string | null>(null);

  const handleUpdate = () => {
    setError(null);
    startTransition(async () => {
      const result = await updateStagingIssue(issue.id, status, resNote);
      if (!result.success) {
        setError(result.error ?? "Failed");
      } else {
        onRefresh();
      }
    });
  };

  const isResolved = issue.status === "resolved" || issue.status === "wont_fix";

  return (
    <div className="border border-slate-800 rounded-lg overflow-hidden">
      <div
        className="flex items-start gap-3 px-4 py-3 bg-slate-900/30 cursor-pointer hover:bg-slate-900/50"
        onClick={() => setExpanded(e => !e)}
      >
        <span className={`text-[10px] px-2 py-0.5 rounded border font-semibold shrink-0 ${issueSeverityColor(issue.severity)}`}>
          {issueSeverityLabel(issue.severity)}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-slate-200 truncate">{issue.title}</p>
          <p className="text-[10px] text-slate-500 mt-0.5">
            {issue.related_area && <span className="mr-2">[{issue.related_area}]</span>}
            {issueStatusLabel(issue.status)} · {issue.created_at.slice(0, 10)}
          </p>
        </div>
        <span className={`text-[10px] px-2 py-0.5 rounded border shrink-0 ${
          isResolved ? "bg-green-900/30 text-green-400 border-green-700/30" : "bg-slate-800 text-slate-400 border-slate-700"
        }`}>
          {issueStatusLabel(issue.status)}
        </span>
        <span className="text-slate-600 text-xs">{expanded ? "▲" : "▼"}</span>
      </div>

      {expanded && (
        <div className="px-4 py-3 bg-slate-900/10 border-t border-slate-800 flex flex-col gap-3">
          {issue.description && (
            <p className="text-xs text-slate-400 whitespace-pre-wrap">{issue.description}</p>
          )}
          {issue.resolution_note && !isResolved && (
            <p className="text-xs text-slate-500">解決メモ: {issue.resolution_note}</p>
          )}

          {/* Update status */}
          <div className="flex flex-wrap gap-2 items-end">
            <div>
              <label className="block text-[10px] text-slate-500 mb-1">ステータス更新</label>
              <select
                value={status}
                onChange={e => setStatus(e.target.value as IssueStatus)}
                className="text-[10px] bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-slate-200"
              >
                {STATUS_OPTIONS.map(s => (
                  <option key={s} value={s}>{issueStatusLabel(s)}</option>
                ))}
              </select>
            </div>
            <div className="flex-1 min-w-48">
              <label className="block text-[10px] text-slate-500 mb-1">解決メモ</label>
              <input
                type="text"
                placeholder="解決内容または対応不要の理由..."
                value={resNote}
                onChange={e => setResNote(e.target.value)}
                className="w-full text-[10px] bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-slate-200 placeholder:text-slate-600"
              />
            </div>
            <button
              onClick={handleUpdate}
              disabled={isPending}
              className="text-[10px] px-3 py-1.5 rounded bg-blue-700 hover:bg-blue-600 text-white disabled:opacity-40 transition-colors"
            >
              {isPending ? "更新中..." : "更新"}
            </button>
          </div>
          {error && <p className="text-[10px] text-red-400">{error}</p>}
        </div>
      )}
    </div>
  );
}

export default function StagingIssuePanel({ issues, runId, onRefresh }: Props) {
  const [isPending,  startTransition] = useTransition();
  const [showForm,   setShowForm]     = useState(false);
  const [title,      setTitle]        = useState("");
  const [description, setDescription] = useState("");
  const [severity,   setSeverity]     = useState<IssueSeverity>("medium");
  const [relatedArea, setRelatedArea] = useState("");
  const [formError,  setFormError]    = useState<string | null>(null);

  const openIssues     = issues.filter(i => i.status === "open" || i.status === "investigating");
  const resolvedIssues = issues.filter(i => i.status === "resolved" || i.status === "wont_fix");

  const criticalOpen = openIssues.filter(i => i.severity === "critical").length;
  const highOpen     = openIssues.filter(i => i.severity === "high").length;

  const handleCreate = () => {
    if (!title.trim()) return;
    setFormError(null);
    startTransition(async () => {
      const result = await createStagingIssue({
        runId,
        title,
        description,
        severity,
        relatedArea,
      });
      if (!result.success) {
        setFormError(result.error ?? "Failed");
      } else {
        setTitle("");
        setDescription("");
        setSeverity("medium");
        setRelatedArea("");
        setShowForm(false);
        onRefresh();
      }
    });
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Summary */}
      <div className="flex items-center gap-4 p-4 rounded-xl border border-slate-800 bg-slate-900/50">
        <div className="flex-1">
          <p className="text-sm font-semibold text-slate-200">課題 ({issues.length})</p>
          <div className="flex gap-4 mt-1 text-[10px]">
            <span className={criticalOpen > 0 ? "text-red-400 font-bold" : "text-slate-500"}>
              Critical: {criticalOpen} open
            </span>
            <span className={highOpen > 0 ? "text-orange-400 font-bold" : "text-slate-500"}>
              High: {highOpen} open
            </span>
            <span className="text-slate-500">
              Open: {openIssues.length} / Resolved: {resolvedIssues.length}
            </span>
          </div>
        </div>
        <button
          onClick={() => setShowForm(s => !s)}
          className="text-xs px-3 py-2 rounded bg-slate-700 hover:bg-slate-600 text-slate-200 transition-colors"
        >
          課題を追加
        </button>
      </div>

      {/* Create issue form */}
      {showForm && (
        <div className="p-4 rounded-xl border border-slate-700 bg-slate-900/40 flex flex-col gap-3">
          <p className="text-xs font-semibold text-slate-300">新規課題</p>

          <input
            type="text"
            placeholder="タイトル *"
            value={title}
            onChange={e => setTitle(e.target.value)}
            className="text-xs bg-slate-800 border border-slate-700 rounded px-3 py-2 text-slate-200 placeholder:text-slate-600"
          />

          <div className="flex gap-2">
            <div className="flex-1">
              <label className="block text-[10px] text-slate-500 mb-1">Severity</label>
              <select
                value={severity}
                onChange={e => setSeverity(e.target.value as IssueSeverity)}
                className="w-full text-xs bg-slate-800 border border-slate-700 rounded px-3 py-2 text-slate-200"
              >
                {SEVERITY_OPTIONS.map(s => (
                  <option key={s} value={s}>{issueSeverityLabel(s)}</option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-[10px] text-slate-500 mb-1">関連エリア</label>
              <input
                type="text"
                placeholder="例: PDF, RLS, LINE"
                value={relatedArea}
                onChange={e => setRelatedArea(e.target.value)}
                className="w-full text-xs bg-slate-800 border border-slate-700 rounded px-3 py-2 text-slate-200 placeholder:text-slate-600"
              />
            </div>
          </div>

          <textarea
            rows={3}
            placeholder="詳細説明 (任意)"
            value={description}
            onChange={e => setDescription(e.target.value)}
            className="text-xs bg-slate-800 border border-slate-700 rounded px-3 py-2 text-slate-200 placeholder:text-slate-600 resize-none"
          />

          {formError && <p className="text-xs text-red-400">{formError}</p>}

          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setShowForm(false)}
              className="text-xs px-3 py-1.5 rounded border border-slate-600 text-slate-400 hover:bg-slate-800"
            >
              キャンセル
            </button>
            <button
              onClick={handleCreate}
              disabled={!title.trim() || isPending}
              className="text-xs px-3 py-1.5 rounded bg-blue-700 hover:bg-blue-600 text-white disabled:opacity-40 transition-colors"
            >
              {isPending ? "作成中..." : "作成"}
            </button>
          </div>
        </div>
      )}

      {/* Open issues */}
      {openIssues.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Open / Investigating</p>
          {openIssues.map(issue => (
            <IssueRow key={issue.id} issue={issue} onRefresh={onRefresh} />
          ))}
        </div>
      )}

      {/* Resolved issues */}
      {resolvedIssues.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Resolved / Won&apos;t Fix</p>
          {resolvedIssues.map(issue => (
            <IssueRow key={issue.id} issue={issue} onRefresh={onRefresh} />
          ))}
        </div>
      )}

      {issues.length === 0 && (
        <p className="text-xs text-slate-600 text-center py-4">課題はまだ登録されていません</p>
      )}
    </div>
  );
}
