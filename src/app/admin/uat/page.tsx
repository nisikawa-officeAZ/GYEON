// PHASE63: Admin UAT management page.
// Manages UAT dealers, sessions, feedback, and issues.
// Super Admin only. No production deployment. No migration execution.

"use client";

import { useState, useEffect, useTransition, useCallback } from "react";
import {
  UatDealerWithSessions,
  UatIssue,
  UatFeedback,
} from "@/lib/uat/uat-types";
import { getUatDashboardData } from "@/lib/uat/uat";
import UatDashboard from "@/components/admin/UatDashboard";

export const dynamic = "force-dynamic";

export default function AdminUatPage() {
  const [dealers,     setDealers]     = useState<UatDealerWithSessions[]>([]);
  const [openIssues,  setOpenIssues]  = useState<UatIssue[]>([]);
  const [allFeedback, setAllFeedback] = useState<UatFeedback[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [, startTransition]           = useTransition();

  const loadData = useCallback(() => {
    setLoading(true);
    startTransition(async () => {
      const data = await getUatDashboardData();
      setDealers(data.dealers);
      setOpenIssues(data.openIssues);
      setAllFeedback(data.allFeedback);
      setLoading(false);
    });
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

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
          <h1 className="text-lg font-semibold text-slate-100">UAT Management</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            User Acceptance Testing — ステージング環境のみ。本番デプロイは行いません。
          </p>
        </div>
        <button
          onClick={loadData}
          className="text-xs px-3 py-1.5 rounded border border-slate-700 text-slate-400 hover:bg-slate-800 transition-colors"
        >
          更新
        </button>
      </div>

      {/* Safety notice */}
      <div className="flex items-start gap-3 px-4 py-3 rounded-xl border border-amber-700/40 bg-amber-950/20">
        <span className="text-amber-400 shrink-0">⚠</span>
        <p className="text-xs text-amber-300">
          UAT はステージング環境のみで実施します。このページはデプロイ・マイグレーション実行・本番変更を行いません。
          詳細は docs/UAT_EXIT_CRITERIA.md を参照してください。
        </p>
      </div>

      {/* UAT Dashboard */}
      <UatDashboard
        dealers={dealers}
        openIssues={openIssues}
        allFeedback={allFeedback}
        onRefresh={loadData}
      />
    </div>
  );
}
