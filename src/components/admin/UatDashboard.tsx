"use client";

// PHASE63: UAT admin dashboard.
// Displays test dealers, sessions, feedback summary, and open issues.

import { useState, useTransition } from "react";
import {
  UatDealerWithSessions,
  UatIssue,
  UatFeedback,
  UatDealerStatus,
  UatIssueSeverity,
  UatIssueStatus,
  uatDealerStatusLabel,
  uatDealerStatusColor,
  uatIssueSeverityLabel,
  uatIssueSeverityColor,
  uatIssueStatusLabel,
} from "@/lib/uat/uat-types";
import {
  createUatDealer,
  updateUatDealerStatus,
  createIssue,
  updateIssue,
} from "@/lib/uat/uat";
import UatFeedbackPanel from "./UatFeedbackPanel";

interface Props {
  dealers:     UatDealerWithSessions[];
  openIssues:  UatIssue[];
  allFeedback: UatFeedback[];
  onRefresh:   () => void;
}

const DEALER_STATUS_OPTIONS: UatDealerStatus[] = ["invited", "active", "completed", "withdrawn"];
const ISSUE_SEVERITY_OPTIONS: UatIssueSeverity[] = ["critical", "high", "medium", "low"];
const ISSUE_STATUS_OPTIONS: UatIssueStatus[]   = ["open", "investigating", "resolved", "wont_fix"];

function IssueRow({ issue, onRefresh }: { issue: UatIssue; onRefresh: () => void }) {
  const [status,    setStatus]    = useState<UatIssueStatus>(issue.status);
  const [res,       setRes]       = useState(issue.resolution ?? "");
  const [expanded,  setExpanded]  = useState(false);
  const [isPending, startTrans]   = useTransition();

  const handleUpdate = () => {
    startTrans(async () => {
      await updateIssue(issue.id, status, res);
      onRefresh();
    });
  };

  return (
    <div className="border border-slate-800 rounded-lg overflow-hidden">
      <div
        className="flex items-center gap-2 px-3 py-2 bg-slate-900/30 cursor-pointer hover:bg-slate-900/50"
        onClick={() => setExpanded(e => !e)}
      >
        <span className={`text-[10px] px-1.5 py-0.5 rounded border font-semibold shrink-0 ${uatIssueSeverityColor(issue.severity)}`}>
          {uatIssueSeverityLabel(issue.severity)}
        </span>
        <p className="text-xs text-slate-200 flex-1 truncate">{issue.title}</p>
        <span className="text-[10px] text-slate-500">{uatIssueStatusLabel(issue.status)}</span>
        <span className="text-slate-600 text-[10px]">{expanded ? "▲" : "▼"}</span>
      </div>
      {expanded && (
        <div className="px-3 py-2 border-t border-slate-800 bg-slate-900/10 flex flex-col gap-2">
          {issue.description && <p className="text-[10px] text-slate-400">{issue.description}</p>}
          <div className="flex flex-wrap gap-2 items-end">
            <select
              value={status}
              onChange={e => setStatus(e.target.value as UatIssueStatus)}
              className="text-[10px] bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-200"
            >
              {ISSUE_STATUS_OPTIONS.map(s => <option key={s} value={s}>{uatIssueStatusLabel(s)}</option>)}
            </select>
            <input
              type="text"
              placeholder="解決メモ..."
              value={res}
              onChange={e => setRes(e.target.value)}
              className="text-[10px] bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-200 placeholder:text-slate-600 flex-1 min-w-32"
            />
            <button
              onClick={handleUpdate}
              disabled={isPending}
              className="text-[10px] px-2 py-1 rounded bg-blue-700 hover:bg-blue-600 text-white disabled:opacity-40"
            >
              {isPending ? "..." : "更新"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function UatDashboard({ dealers, openIssues, allFeedback, onRefresh }: Props) {
  const [isPending,  startTrans]  = useTransition();
  const [showAdd,    setShowAdd]  = useState(false);
  const [showIssue,  setShowIssue] = useState(false);
  const [activeDeal, setActiveDeal] = useState<string | null>(null);

  // New dealer form
  const [dName, setDName]   = useState("");
  const [dCon,  setDCon]    = useState("");
  const [dMail, setDMail]   = useState("");
  const [dCo,   setDCo]     = useState("");
  const [dNote, setDNote]   = useState("");
  const [addErr, setAddErr]  = useState<string | null>(null);

  // New issue form
  const [iSev,   setISev]  = useState<UatIssueSeverity>("medium");
  const [iTitle, setITitle] = useState("");
  const [iDesc,  setIDesc]  = useState("");
  const [iErr,   setIErr]   = useState<string | null>(null);

  const criticalOpen = openIssues.filter(i => i.severity === "critical").length;
  const highOpen     = openIssues.filter(i => i.severity === "high").length;
  const completedCount = dealers.filter(d => d.status === "completed").length;
  const avgRating = allFeedback.length > 0
    ? (allFeedback.filter(f => f.rating).reduce((s, f) => s + (f.rating ?? 0), 0) / allFeedback.filter(f => f.rating).length).toFixed(1)
    : "—";

  const handleAddDealer = () => {
    if (!dName.trim()) return;
    setAddErr(null);
    startTrans(async () => {
      const result = await createUatDealer({ dealerName: dName, contactName: dCon, email: dMail, country: dCo, notes: dNote });
      if (!result.success) { setAddErr(result.error ?? "Failed"); }
      else { setDName(""); setDCon(""); setDMail(""); setDCo(""); setDNote(""); setShowAdd(false); onRefresh(); }
    });
  };

  const handleAddIssue = () => {
    if (!iTitle.trim()) return;
    setIErr(null);
    startTrans(async () => {
      const result = await createIssue({ severity: iSev, title: iTitle, description: iDesc });
      if (!result.success) { setIErr(result.error ?? "Failed"); }
      else { setITitle(""); setIDesc(""); setISev("medium"); setShowIssue(false); onRefresh(); }
    });
  };

  const handleStatusChange = (dealerId: string, status: UatDealerStatus) => {
    startTrans(async () => { await updateUatDealerStatus(dealerId, status); onRefresh(); });
  };

  const activeDealer = dealers.find(d => d.id === activeDeal);

  return (
    <div className="flex flex-col gap-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/50">
          <p className="text-[10px] text-slate-500 mb-1">Dealers Completed</p>
          <p className="text-2xl font-bold text-slate-100">{completedCount}<span className="text-sm text-slate-500">/{dealers.length}</span></p>
        </div>
        <div className={`p-4 rounded-xl border bg-slate-900/50 ${criticalOpen > 0 ? "border-red-700/50" : "border-slate-800"}`}>
          <p className="text-[10px] text-slate-500 mb-1">Critical Issues Open</p>
          <p className={`text-2xl font-bold ${criticalOpen > 0 ? "text-red-400" : "text-slate-100"}`}>{criticalOpen}</p>
        </div>
        <div className={`p-4 rounded-xl border bg-slate-900/50 ${highOpen > 0 ? "border-orange-700/50" : "border-slate-800"}`}>
          <p className="text-[10px] text-slate-500 mb-1">High Issues Open</p>
          <p className={`text-2xl font-bold ${highOpen > 0 ? "text-orange-400" : "text-slate-100"}`}>{highOpen}</p>
        </div>
        <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/50">
          <p className="text-[10px] text-slate-500 mb-1">Avg Rating</p>
          <p className="text-2xl font-bold text-amber-400">{avgRating}<span className="text-sm text-slate-500"> / 5</span></p>
        </div>
      </div>

      {/* UAT Dealers table */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-200">UAT Dealers ({dealers.length})</p>
          <button
            onClick={() => setShowAdd(s => !s)}
            className="text-xs px-3 py-1.5 rounded bg-slate-700 hover:bg-slate-600 text-slate-200 transition-colors"
          >
            ディーラー追加
          </button>
        </div>

        {showAdd && (
          <div className="p-4 rounded-xl border border-slate-700 bg-slate-900/40 flex flex-col gap-2">
            <p className="text-xs font-semibold text-slate-300">新規 UAT ディーラー</p>
            <div className="flex gap-2 flex-wrap">
              <input type="text" placeholder="ディーラー名 *" value={dName} onChange={e => setDName(e.target.value)} className="text-xs bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-slate-200 placeholder:text-slate-600 flex-1 min-w-36" />
              <input type="text" placeholder="担当者名" value={dCon} onChange={e => setDCon(e.target.value)} className="text-xs bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-slate-200 placeholder:text-slate-600 flex-1 min-w-28" />
              <input type="text" placeholder="Email" value={dMail} onChange={e => setDMail(e.target.value)} className="text-xs bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-slate-200 placeholder:text-slate-600 flex-1 min-w-36" />
              <input type="text" placeholder="国" value={dCo} onChange={e => setDCo(e.target.value)} className="text-xs bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-slate-200 placeholder:text-slate-600 w-24" />
              <input type="text" placeholder="メモ" value={dNote} onChange={e => setDNote(e.target.value)} className="text-xs bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-slate-200 placeholder:text-slate-600 flex-1 min-w-36" />
            </div>
            {addErr && <p className="text-xs text-red-400">{addErr}</p>}
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowAdd(false)} className="text-xs px-3 py-1.5 rounded border border-slate-600 text-slate-400 hover:bg-slate-800">キャンセル</button>
              <button onClick={handleAddDealer} disabled={!dName.trim() || isPending} className="text-xs px-3 py-1.5 rounded bg-blue-700 hover:bg-blue-600 text-white disabled:opacity-40">
                {isPending ? "追加中..." : "追加"}
              </button>
            </div>
          </div>
        )}

        <div className="rounded-xl border border-slate-800 overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-900 border-b border-slate-800">
                <th className="text-left px-4 py-2.5 text-slate-400 font-medium">Dealer</th>
                <th className="text-left px-4 py-2.5 text-slate-400 font-medium">Country</th>
                <th className="text-left px-4 py-2.5 text-slate-400 font-medium">Status</th>
                <th className="text-left px-4 py-2.5 text-slate-400 font-medium">Sessions</th>
                <th className="text-left px-4 py-2.5 text-slate-400 font-medium">Feedback</th>
                <th className="text-left px-4 py-2.5 text-slate-400 font-medium">Started</th>
                <th className="text-left px-4 py-2.5 text-slate-400 font-medium">Completed</th>
                <th className="text-left px-4 py-2.5 text-slate-400 font-medium w-8" />
              </tr>
            </thead>
            <tbody>
              {dealers.map((d, i) => {
                const firstSession = d.sessions.sort((a, b) => a.started_at.localeCompare(b.started_at))[0];
                const lastCompleted = d.sessions.filter(s => s.status === "completed").sort((a, b) => (b.ended_at ?? "").localeCompare(a.ended_at ?? ""))[0];
                return (
                  <tr key={d.id} className={`border-b border-slate-800/50 last:border-0 ${i % 2 === 0 ? "bg-slate-900/10" : ""}`}>
                    <td className="px-4 py-2.5">
                      <p className="text-slate-200 font-medium">{d.dealer_name}</p>
                      {d.contact_name && <p className="text-[10px] text-slate-500">{d.contact_name}</p>}
                    </td>
                    <td className="px-4 py-2.5 text-slate-400">{d.country ?? "—"}</td>
                    <td className="px-4 py-2.5">
                      <select
                        value={d.status}
                        onChange={e => handleStatusChange(d.id, e.target.value as UatDealerStatus)}
                        className={`text-[10px] px-2 py-0.5 rounded border ${uatDealerStatusColor(d.status)} bg-transparent`}
                      >
                        {DEALER_STATUS_OPTIONS.map(s => <option key={s} value={s}>{uatDealerStatusLabel(s)}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-2.5 text-slate-400 tabular-nums">{d.sessions.length}</td>
                    <td className="px-4 py-2.5 text-slate-400 tabular-nums">{d.feedback.length}</td>
                    <td className="px-4 py-2.5 text-slate-500 text-[10px]">{firstSession?.started_at.slice(0, 10) ?? "—"}</td>
                    <td className="px-4 py-2.5 text-slate-500 text-[10px]">{lastCompleted?.ended_at?.slice(0, 10) ?? "—"}</td>
                    <td className="px-4 py-2.5">
                      <button
                        onClick={() => setActiveDeal(activeDeal === d.id ? null : d.id)}
                        className="text-[10px] px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 text-slate-300"
                      >
                        {activeDeal === d.id ? "閉じる" : "詳細"}
                      </button>
                    </td>
                  </tr>
                );
              })}
              {dealers.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-6 text-center text-slate-600 text-xs">UAT ディーラーがまだ登録されていません</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Feedback panel for active dealer */}
      {activeDealer && (
        <div className="rounded-xl border border-blue-800/30 bg-blue-950/10 p-4">
          <p className="text-sm font-semibold text-slate-200 mb-3">{activeDealer.dealer_name} — Feedback & Sessions</p>
          <UatFeedbackPanel
            dealerId={activeDealer.id}
            sessions={activeDealer.sessions}
            feedback={activeDealer.feedback}
            onRefresh={onRefresh}
          />
        </div>
      )}

      {/* Open Issues */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-200">
            Open Issues
            {criticalOpen > 0 && <span className="ml-2 text-xs text-red-400">⚠ {criticalOpen} Critical</span>}
          </p>
          <button onClick={() => setShowIssue(s => !s)} className="text-xs px-3 py-1.5 rounded bg-slate-700 hover:bg-slate-600 text-slate-200">
            課題を追加
          </button>
        </div>

        {showIssue && (
          <div className="p-4 rounded-xl border border-slate-700 bg-slate-900/40 flex flex-col gap-2">
            <div className="flex gap-2 flex-wrap items-end">
              <div>
                <label className="block text-[10px] text-slate-500 mb-1">Severity</label>
                <select value={iSev} onChange={e => setISev(e.target.value as UatIssueSeverity)} className="text-xs bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-slate-200">
                  {ISSUE_SEVERITY_OPTIONS.map(s => <option key={s} value={s}>{uatIssueSeverityLabel(s)}</option>)}
                </select>
              </div>
              <input type="text" placeholder="タイトル *" value={iTitle} onChange={e => setITitle(e.target.value)} className="text-xs bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-slate-200 placeholder:text-slate-600 flex-1 min-w-48" />
            </div>
            <textarea rows={2} placeholder="詳細説明..." value={iDesc} onChange={e => setIDesc(e.target.value)} className="text-xs bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-slate-200 placeholder:text-slate-600 resize-none" />
            {iErr && <p className="text-xs text-red-400">{iErr}</p>}
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowIssue(false)} className="text-xs px-3 py-1.5 rounded border border-slate-600 text-slate-400 hover:bg-slate-800">キャンセル</button>
              <button onClick={handleAddIssue} disabled={!iTitle.trim() || isPending} className="text-xs px-3 py-1.5 rounded bg-blue-700 hover:bg-blue-600 text-white disabled:opacity-40">
                {isPending ? "..." : "追加"}
              </button>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-2">
          {openIssues.map(issue => <IssueRow key={issue.id} issue={issue} onRefresh={onRefresh} />)}
          {openIssues.length === 0 && (
            <p className="text-xs text-slate-600 text-center py-4">オープン中の課題はありません</p>
          )}
        </div>
      </div>
    </div>
  );
}
