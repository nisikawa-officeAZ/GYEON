"use client";

// PHASE62: Staging verification checklist panel.
// Allows operators to record pass/fail per checklist item.
// IMPORTANT: No migration apply button. No SQL execution. No deploy button.

import { useState, useTransition } from "react";
import {
  StagingVerificationRun,
  StagingVerificationItem,
  VerificationItemStatus,
  VerificationRunStatus,
  CHECKLIST_CATEGORIES,
  getItemsByCategory,
  getCategoryStatus,
  getRunOverallStatus,
  itemStatusColor,
  runStatusColor,
} from "@/lib/staging-verification/checklist";
import {
  updateVerificationItemStatus,
  completeVerificationRun,
  createVerificationRun,
} from "@/lib/staging-verification/staging-verification";

interface Props {
  runs:        StagingVerificationRun[];
  currentRun:  StagingVerificationRun | null;
  items:       StagingVerificationItem[];
  onRunChange: (runId: string) => void;
}

const ITEM_STATUS_OPTIONS: { value: VerificationItemStatus; label: string }[] = [
  { value: "pending",        label: "— Pending" },
  { value: "passed",         label: "✓ Passed" },
  { value: "failed",         label: "✗ Failed" },
  { value: "blocked",        label: "⊘ Blocked" },
  { value: "not_applicable", label: "N/A" },
];

const RUN_STATUS_OPTIONS: { value: Exclude<VerificationRunStatus, "in_progress">; label: string }[] = [
  { value: "passed",  label: "Passed — all required items verified" },
  { value: "failed",  label: "Failed — one or more items failed" },
  { value: "blocked", label: "Blocked — cannot complete verification" },
];

function CategorySection({
  category,
  items,
  disabled,
}: {
  category: string;
  items:    StagingVerificationItem[];
  disabled: boolean;
}) {
  const [expanded, setExpanded] = useState(true);
  const [localItems, setLocalItems] = useState<Record<string, {
    status:       VerificationItemStatus;
    note:         string;
    evidenceUrl:  string;
    saving:       boolean;
    saved:        boolean;
    error:        string | null;
  }>>(() => Object.fromEntries(
    items.map(i => [i.id, {
      status:      i.status,
      note:        i.operator_note ?? "",
      evidenceUrl: i.evidence_url  ?? "",
      saving:      false,
      saved:       false,
      error:       null,
    }])
  ));

  const catStatus = getCategoryStatus(items);

  const handleSave = async (itemId: string) => {
    const local = localItems[itemId];
    if (!local) return;

    setLocalItems(prev => ({ ...prev, [itemId]: { ...prev[itemId], saving: true, error: null } }));
    const result = await updateVerificationItemStatus(
      itemId,
      local.status,
      local.note,
      local.evidenceUrl
    );
    setLocalItems(prev => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        saving: false,
        saved:  result.success,
        error:  result.error ?? null,
      },
    }));
  };

  return (
    <div className="rounded-xl border border-slate-800 overflow-hidden">
      {/* Category header */}
      <button
        className="w-full flex items-center justify-between px-4 py-3 bg-slate-900/70 hover:bg-slate-900 transition-colors text-left"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-slate-200">{category}</span>
          <span className={`text-[10px] px-2 py-0.5 rounded border ${itemStatusColor(catStatus)}`}>
            {catStatus === "pending"
              ? `${items.filter(i => i.status !== "pending" && i.status !== "not_applicable").length}/${items.length}`
              : catStatus === "passed" ? "All Passed"
              : catStatus === "failed" ? "Has Failures"
              : catStatus === "blocked" ? "Blocked"
              : catStatus}
          </span>
        </div>
        <span className="text-slate-600 text-xs">{expanded ? "▲" : "▼"}</span>
      </button>

      {/* Items */}
      {expanded && (
        <div className="divide-y divide-slate-800/50">
          {items.map(item => {
            const local = localItems[item.id];
            if (!local) return null;
            return (
              <div key={item.id} className="px-4 py-3 bg-slate-900/20">
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-slate-300 mb-2">{item.label}</p>

                    {/* Status + Note + Evidence on one row */}
                    <div className="flex flex-wrap gap-2 items-start">
                      {/* Status select */}
                      <select
                        value={local.status}
                        onChange={e => {
                          setLocalItems(prev => ({
                            ...prev,
                            [item.id]: { ...prev[item.id], status: e.target.value as VerificationItemStatus, saved: false },
                          }));
                        }}
                        disabled={disabled}
                        className="text-[10px] bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-slate-200 disabled:opacity-50"
                      >
                        {ITEM_STATUS_OPTIONS.map(o => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>

                      {/* Note */}
                      <input
                        type="text"
                        placeholder="Operator note (optional)"
                        value={local.note}
                        onChange={e => setLocalItems(prev => ({
                          ...prev,
                          [item.id]: { ...prev[item.id], note: e.target.value, saved: false },
                        }))}
                        disabled={disabled}
                        className="text-[10px] bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-slate-300 placeholder:text-slate-600 w-52 disabled:opacity-50"
                      />

                      {/* Evidence URL */}
                      <input
                        type="text"
                        placeholder="Evidence URL (optional)"
                        value={local.evidenceUrl}
                        onChange={e => setLocalItems(prev => ({
                          ...prev,
                          [item.id]: { ...prev[item.id], evidenceUrl: e.target.value, saved: false },
                        }))}
                        disabled={disabled}
                        className="text-[10px] bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-slate-300 placeholder:text-slate-600 w-44 disabled:opacity-50"
                      />

                      {/* Save button */}
                      <button
                        onClick={() => handleSave(item.id)}
                        disabled={disabled || local.saving}
                        className="text-[10px] px-2.5 py-1.5 rounded bg-blue-700 hover:bg-blue-600 text-white disabled:opacity-40 transition-colors shrink-0"
                      >
                        {local.saving ? "保存中..." : "保存"}
                      </button>

                      {local.saved  && <span className="text-[10px] text-green-400">✓ 保存</span>}
                      {local.error  && <span className="text-[10px] text-red-400">{local.error}</span>}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function StagingVerificationPanel({ runs, currentRun, items, onRunChange }: Props) {
  const [isPending, startTransition] = useTransition();
  const [newRunName, setNewRunName] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [completeStatus, setCompleteStatus] = useState<Exclude<VerificationRunStatus, "in_progress">>("passed");
  const [completeSummary, setCompleteSummary] = useState("");
  const [completeError, setCompleteError] = useState<string | null>(null);

  const grouped   = getItemsByCategory(items);
  const suggested = currentRun ? getRunOverallStatus(items) : "in_progress";
  const isCompleted = currentRun?.status !== "in_progress";

  const handleCreateRun = () => {
    if (!newRunName.trim()) return;
    setCreateError(null);
    startTransition(async () => {
      const result = await createVerificationRun(newRunName.trim());
      if (!result.success) {
        setCreateError(result.error ?? "Failed to create run");
      } else if (result.runId) {
        setNewRunName("");
        onRunChange(result.runId);
      }
    });
  };

  const handleCompleteRun = () => {
    if (!currentRun) return;
    setCompleteError(null);
    startTransition(async () => {
      const result = await completeVerificationRun(currentRun.id, completeStatus, completeSummary);
      if (!result.success) {
        setCompleteError(result.error ?? "Failed to complete run");
      } else {
        setShowCompleteModal(false);
        onRunChange(currentRun.id);
      }
    });
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Run selector + create */}
      <div className="flex flex-wrap items-end gap-4 p-4 rounded-xl border border-slate-800 bg-slate-900/50">
        <div className="flex-1 min-w-48">
          <label className="block text-[10px] text-slate-500 mb-1">検証ランを選択</label>
          <select
            value={currentRun?.id ?? ""}
            onChange={e => onRunChange(e.target.value)}
            className="w-full text-xs bg-slate-800 border border-slate-700 rounded px-3 py-2 text-slate-200"
          >
            <option value="">— 選択してください —</option>
            {runs.map(r => (
              <option key={r.id} value={r.id}>
                {r.run_name} [{r.status}] {r.started_at.slice(0, 10)}
              </option>
            ))}
          </select>
        </div>

        {/* Create new run */}
        <div className="flex items-end gap-2">
          <div>
            <label className="block text-[10px] text-slate-500 mb-1">新規ランを作成</label>
            <input
              type="text"
              placeholder="例: Staging Verification — 2026-06-21"
              value={newRunName}
              onChange={e => setNewRunName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleCreateRun()}
              className="text-xs bg-slate-800 border border-slate-700 rounded px-3 py-2 text-slate-200 placeholder:text-slate-600 w-72"
            />
          </div>
          <button
            onClick={handleCreateRun}
            disabled={!newRunName.trim() || isPending}
            className="text-xs px-4 py-2 rounded bg-blue-700 hover:bg-blue-600 text-white disabled:opacity-40 transition-colors"
          >
            {isPending ? "作成中..." : "作成"}
          </button>
        </div>
        {createError && <p className="text-xs text-red-400 w-full">{createError}</p>}
      </div>

      {/* Current run status bar */}
      {currentRun && (
        <div className="flex items-center gap-4 p-4 rounded-xl border border-slate-800 bg-slate-900/40">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-0.5">
              <p className="text-sm font-semibold text-slate-100">{currentRun.run_name}</p>
              <span className={`text-[10px] px-2 py-0.5 rounded border font-semibold ${runStatusColor(currentRun.status)}`}>
                {currentRun.status}
              </span>
            </div>
            <p className="text-[10px] text-slate-500">
              開始: {currentRun.started_at.slice(0, 16).replace("T", " ")}
              {currentRun.completed_at && ` / 完了: ${currentRun.completed_at.slice(0, 16).replace("T", " ")}`}
            </p>
            {currentRun.summary && (
              <p className="text-xs text-slate-400 mt-1">{currentRun.summary}</p>
            )}
          </div>

          {/* Progress summary */}
          <div className="text-right text-[10px] text-slate-500 shrink-0">
            <div className="flex gap-3">
              <span className="text-green-400">{items.filter(i => i.status === "passed").length} Passed</span>
              <span className="text-red-400">{items.filter(i => i.status === "failed").length} Failed</span>
              <span className="text-orange-400">{items.filter(i => i.status === "blocked").length} Blocked</span>
              <span className="text-slate-500">{items.filter(i => i.status === "pending").length} Pending</span>
            </div>
          </div>

          {/* Complete run button — only for in-progress runs */}
          {!isCompleted && (
            <button
              onClick={() => {
                setCompleteStatus(suggested !== "in_progress" ? suggested : "passed");
                setShowCompleteModal(true);
              }}
              className="text-xs px-3 py-2 rounded bg-green-800 hover:bg-green-700 text-white transition-colors shrink-0"
            >
              ランを完了する
            </button>
          )}
        </div>
      )}

      {/* Checklist grouped by category */}
      {currentRun && (
        <div className="flex flex-col gap-3">
          {CHECKLIST_CATEGORIES.map(cat => {
            const catItems = grouped[cat] ?? [];
            if (catItems.length === 0) return null;
            return (
              <CategorySection
                key={cat}
                category={cat}
                items={catItems}
                disabled={isCompleted}
              />
            );
          })}
        </div>
      )}

      {!currentRun && (
        <div className="flex items-center justify-center py-16 text-sm text-slate-500">
          検証ランを選択するか、新規ランを作成してください
        </div>
      )}

      {/* Complete run modal */}
      {showCompleteModal && currentRun && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
          <div className="bg-[#0f172a] border border-slate-700 rounded-xl p-6 w-full max-w-md">
            <h3 className="text-sm font-semibold text-slate-100 mb-4">検証ランを完了する</h3>

            <p className="text-xs text-amber-400 mb-4">
              ⚠ この操作はデプロイしません。マイグレーションを実行しません。
              検証ランのステータスを記録するのみです。
            </p>

            <div className="mb-3">
              <label className="block text-[10px] text-slate-500 mb-1">最終ステータス</label>
              <select
                value={completeStatus}
                onChange={e => setCompleteStatus(e.target.value as typeof completeStatus)}
                className="w-full text-xs bg-slate-800 border border-slate-700 rounded px-3 py-2 text-slate-200"
              >
                {RUN_STATUS_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              {suggested !== "in_progress" && (
                <p className="text-[10px] text-slate-500 mt-1">
                  推奨: {suggested} (チェックリスト状態から)
                </p>
              )}
            </div>

            <div className="mb-4">
              <label className="block text-[10px] text-slate-500 mb-1">サマリーノート</label>
              <textarea
                rows={3}
                placeholder="検証結果のサマリーを記入してください..."
                value={completeSummary}
                onChange={e => setCompleteSummary(e.target.value)}
                className="w-full text-xs bg-slate-800 border border-slate-700 rounded px-3 py-2 text-slate-200 placeholder:text-slate-600 resize-none"
              />
            </div>

            {completeError && <p className="text-xs text-red-400 mb-3">{completeError}</p>}

            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowCompleteModal(false)}
                className="text-xs px-4 py-2 rounded border border-slate-600 text-slate-400 hover:bg-slate-800 transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={handleCompleteRun}
                disabled={isPending}
                className="text-xs px-4 py-2 rounded bg-green-700 hover:bg-green-600 text-white disabled:opacity-40 transition-colors"
              >
                {isPending ? "完了中..." : "確定"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
