// PHASE62: Admin staging verification page.
// Operators record pass/fail for each verification checklist item.
// IMPORTANT: No migration apply. No SQL execution. No production deployment.

"use client";

import { useState, useEffect, useTransition, useCallback } from "react";
import {
  StagingVerificationRun,
  StagingVerificationItem,
  StagingIssue,
} from "@/lib/staging-verification/checklist";
import {
  getVerificationRuns,
  getVerificationRun,
} from "@/lib/staging-verification/staging-verification";
import StagingVerificationPanel from "@/components/admin/StagingVerificationPanel";
import StagingIssuePanel        from "@/components/admin/StagingIssuePanel";

export const dynamic = "force-dynamic";

export default function AdminStagingVerificationPage() {
  const [runs,       setRuns]       = useState<StagingVerificationRun[]>([]);
  const [currentRun, setCurrentRun] = useState<StagingVerificationRun | null>(null);
  const [items,      setItems]      = useState<StagingVerificationItem[]>([]);
  const [issues,     setIssues]     = useState<StagingIssue[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [, startTransition]         = useTransition();

  // Load runs list on mount
  useEffect(() => {
    getVerificationRuns().then(data => {
      setRuns(data);
      // Auto-select the most recent in-progress run, or most recent overall
      const inProgress = data.find(r => r.status === "in_progress");
      const toSelect   = inProgress ?? data[0] ?? null;
      if (toSelect) loadRun(toSelect.id, data);
      else setLoading(false);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadRun = useCallback((runId: string, runList?: StagingVerificationRun[]) => {
    setLoading(true);
    startTransition(async () => {
      const [{ run, items: its, issues: iss }, freshRuns] = await Promise.all([
        getVerificationRun(runId),
        getVerificationRuns(),
      ]);
      setRuns(runList ?? freshRuns);
      setCurrentRun(run);
      setItems(its);
      setIssues(iss);
      setLoading(false);
    });
  }, []);

  const handleRunChange = (runId: string) => {
    if (runId) loadRun(runId);
  };

  const handleIssueRefresh = () => {
    if (currentRun) loadRun(currentRun.id);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-sm text-slate-500">
        読み込み中...
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Page header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-100">Staging Verification</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            ステージング環境の検証結果を記録します（読み取り専用 — マイグレーション実行不可）
          </p>
        </div>
      </div>

      {/* Safety notice */}
      <div className="flex items-start gap-3 px-4 py-3 rounded-xl border border-amber-700/40 bg-amber-950/20">
        <span className="text-amber-400 shrink-0">⚠</span>
        <p className="text-xs text-amber-300">
          このページはマイグレーションの適用・SQLの実行・本番環境へのデプロイを行いません。
          マイグレーションは Supabase SQL Editor で手動で適用してください
          （docs/STAGING_MIGRATION_EXECUTION_GUIDE.md 参照）。
        </p>
      </div>

      {/* Verification checklist panel */}
      <StagingVerificationPanel
        runs={runs}
        currentRun={currentRun}
        items={items}
        onRunChange={handleRunChange}
      />

      {/* Issue panel */}
      {currentRun && (
        <div>
          <h2 className="text-sm font-semibold text-slate-200 mb-3">課題トラッカー</h2>
          <StagingIssuePanel
            issues={issues}
            runId={currentRun.id}
            onRefresh={handleIssueRefresh}
          />
        </div>
      )}
    </div>
  );
}
