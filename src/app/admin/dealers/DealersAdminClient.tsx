"use client";

import { useState, useTransition, useMemo } from "react";
import { approveDealerTrial, rejectDealer, suspendDealer, reactivateDealer, deleteDealer } from "@/lib/admin/approve-dealer";
import DealerDetailPanel from "./DealerDetailPanel";
import type { DealerAdminView } from "@/lib/admin/admin-types";
import { DEALER_RANKS, normalizeRank, rankLabelOrDash, DEFAULT_DEALER_RANK } from "@/lib/ranks/dealer-ranks";

type StatusFilter = "all" | "pending" | "approved" | "rejected" | "suspended";
type PlanFilter   = "all" | "basic" | "pro" | "pro_plus";
type TrialFilter  = "all" | "active" | "ended" | "none";
type RankFilter   = "all" | "shop" | "detailer" | "certified";

type Modal =
  | { type: "none" }
  | { type: "approve";    dealer: DealerAdminView }
  | { type: "reject";     dealer: DealerAdminView }
  | { type: "suspend";    dealer: DealerAdminView }
  | { type: "delete";     dealer: DealerAdminView }
  | { type: "detail";     dealer: DealerAdminView };

// ── Helpers ──────────────────────────────────────────────────────────────────

function today(): string {
  return new Date().toISOString().split("T")[0];
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

function calcDaysRemaining(trialEnd: string | null | undefined): number | null {
  if (!trialEnd) return null;
  const t = new Date(today()).getTime();
  const e = new Date(trialEnd).getTime();
  return Math.round((e - t) / 86_400_000);
}

function fmt(d: string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("ja-JP", { year: "numeric", month: "2-digit", day: "2-digit" });
}

function planLabel(p: string | null): string {
  switch (p) {
    case "pro_plus": return "Pro Plus";
    case "pro":      return "Pro";
    case "basic":    return "Basic";
    default:         return p ?? "—";
  }
}

function planClass(p: string | null): string {
  switch (p) {
    case "pro_plus": return "text-purple-300 bg-purple-900/30 border-purple-700/40";
    case "pro":      return "text-blue-300   bg-blue-900/30   border-blue-700/40";
    default:         return "text-slate-400  bg-slate-800/60  border-slate-700/40";
  }
}

function rankLabel(r: string | null): string {
  return rankLabelOrDash(r);
}

function rankClass(r: string | null): string {
  if (!r || !r.trim()) return "text-slate-600 bg-transparent  border-transparent";
  switch (normalizeRank(r)) {
    case "certified": return "text-amber-300   bg-amber-900/30   border-amber-700/40";
    case "detailer":           return "text-sky-300     bg-sky-900/30     border-sky-700/40";
    case "shop":               return "text-emerald-300 bg-emerald-900/30 border-emerald-700/40";
    default:                   return "text-slate-600 bg-transparent  border-transparent";
  }
}

function approvalClass(s: string | null): string {
  switch (s) {
    case "approved":  return "text-green-300 bg-green-900/30 border-green-700/40";
    case "rejected":  return "text-red-300   bg-red-900/30   border-red-700/40";
    case "suspended": return "text-orange-300 bg-orange-900/30 border-orange-700/40";
    case "pending":
    default:          return "text-amber-300 bg-amber-900/30 border-amber-700/40";
  }
}

function approvalLabel(s: string | null): string {
  switch (s) {
    case "approved":  return "承認済み";
    case "rejected":  return "拒否";
    case "suspended": return "停止";
    default:          return "承認待ち";
  }
}

function TrialCountdown({ dealer }: { dealer: DealerAdminView }) {
  const { trial_status, trial_end_date, plan, auto_downgrade_plan_type } = dealer;

  if (trial_status === "active") {
    const days = calcDaysRemaining(trial_end_date);
    if (days === null)  return <span className="text-xs text-amber-400">試用中</span>;
    if (days === 0)     return <span className="text-xs font-semibold text-red-400">本日終了</span>;
    if (days < 0)       return <span className="text-xs text-slate-500">—</span>;
    if (days <= 7)      return <span className="text-xs font-medium text-red-400">残り{days}日</span>;
    return <span className="text-xs text-amber-300">残り{days}日</span>;
  }

  if (trial_status === "ended") {
    const downgradedTo = auto_downgrade_plan_type ?? plan;
    return (
      <span className="text-[10px] text-slate-500">
        {planLabel(downgradedTo)}へ移行済み
      </span>
    );
  }

  return <span className="text-slate-700 text-xs">—</span>;
}

// ── Approval Modal ────────────────────────────────────────────────────────────

function ApproveModal({
  dealer,
  onClose,
  onApprove,
  isPending,
}: {
  dealer: DealerAdminView;
  onClose: () => void;
  onApprove: (opts: { detailerRank: string; initialPlan: string; serviceStartDate: string; trialEndDate: string }) => void;
  isPending: boolean;
}) {
  const [rank,         setRank]         = useState<string>(DEFAULT_DEALER_RANK);
  const [plan,         setPlan]         = useState("pro_plus");
  const [startDate,    setStartDate]    = useState(today());
  const [trialDays,    setTrialDays]    = useState(30);

  const trialEnd = addDays(startDate, trialDays);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-[#0f172a] border border-slate-700 rounded-2xl w-full max-w-xl mx-4 overflow-hidden shadow-2xl">

        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-100">Approve Dealer</h2>
            <p className="text-xs text-slate-500 mt-0.5">{dealer.name ?? "（名称未設定）"}</p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 text-xl leading-none">✕</button>
        </div>

        {/* Dealer info */}
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-900/40">
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <div className="text-slate-600 mb-0.5">メール</div>
              <div className="text-slate-300">{dealer.email ?? "—"}</div>
            </div>
            <div>
              <div className="text-slate-600 mb-0.5">電話番号</div>
              <div className="text-slate-300">{dealer.phone ?? "—"}</div>
            </div>
            <div>
              <div className="text-slate-600 mb-0.5">申請日</div>
              <div className="text-slate-300">{fmt(dealer.created_at)}</div>
            </div>
            <div>
              <div className="text-slate-600 mb-0.5">ID</div>
              <div className="text-slate-500 font-mono">{dealer.id.slice(0, 12)}…</div>
            </div>
          </div>
        </div>

        {/* Configuration */}
        <div className="px-6 py-5 space-y-5">

          {/* Detailer Rank */}
          <div>
            <label className="text-xs font-medium text-slate-400 block mb-2">Detailer Rank</label>
            <div className="flex gap-2">
              {DEALER_RANKS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setRank(opt.value)}
                  className={`flex-1 py-2 rounded-lg border text-xs font-medium transition-colors ${
                    rank === opt.value
                      ? "bg-amber-700/30 border-amber-600/60 text-amber-300"
                      : "bg-slate-800/40 border-slate-700 text-slate-400 hover:border-slate-600"
                  }`}
                >
                  {opt.labelEn}
                </button>
              ))}
            </div>
          </div>

          {/* Initial Plan */}
          <div>
            <label className="text-xs font-medium text-slate-400 block mb-2">
              Initial Plan <span className="text-slate-600 font-normal">(default: Pro Plus)</span>
            </label>
            <div className="flex gap-2">
              {[
                { value: "pro_plus", label: "Pro Plus",  cls: "text-purple-300 border-purple-700/60 bg-purple-900/20" },
                { value: "pro",      label: "Pro",       cls: "text-blue-300   border-blue-700/60   bg-blue-900/20"   },
                { value: "basic",    label: "Basic",     cls: "text-slate-300  border-slate-600/60  bg-slate-800/30"  },
              ].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setPlan(opt.value)}
                  className={`flex-1 py-2 rounded-lg border text-xs font-medium transition-colors ${
                    plan === opt.value
                      ? opt.cls
                      : "bg-slate-800/20 border-slate-700/40 text-slate-500 hover:border-slate-600"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-slate-400 block mb-2">
                Service Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-800 border border-slate-600 rounded-lg text-slate-200 focus:outline-none focus:border-slate-400"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-400 block mb-2">
                Trial Period <span className="text-slate-600 font-normal">(days)</span>
              </label>
              <input
                type="number"
                value={trialDays}
                min={1}
                max={365}
                onChange={(e) => setTrialDays(Math.max(1, parseInt(e.target.value) || 30))}
                className="w-full px-3 py-2 text-sm bg-slate-800 border border-slate-600 rounded-lg text-slate-200 focus:outline-none focus:border-slate-400"
              />
            </div>
          </div>

          {/* Calculated trial end */}
          <div className="bg-slate-800/40 border border-slate-700/50 rounded-lg px-4 py-3 flex items-center justify-between">
            <span className="text-xs text-slate-500">Trial End Date（自動計算）</span>
            <span className="text-sm font-semibold text-amber-300">{fmt(trialEnd)}</span>
          </div>

          {/* Auto-downgrade notice */}
          <p className="text-[10px] text-slate-600">
            試用終了後: {planLabel("basic")}プランへ自動ダウングレード
          </p>
        </div>

        {/* Actions */}
        <div className="px-6 py-4 border-t border-slate-800 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm rounded-lg transition-colors"
          >
            キャンセル
          </button>
          <button
            onClick={() => onApprove({ detailerRank: rank, initialPlan: plan, serviceStartDate: startDate, trialEndDate: trialEnd })}
            disabled={isPending}
            className="px-5 py-2 bg-green-700 hover:bg-green-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            承認する
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Reject Modal ──────────────────────────────────────────────────────────────

function RejectModal({
  dealer, onClose, onReject, isPending,
}: { dealer: DealerAdminView; onClose: () => void; onReject: (reason: string) => void; isPending: boolean }) {
  const [reason, setReason] = useState("");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-[#0f172a] border border-slate-700 rounded-2xl w-full max-w-md mx-4 p-6 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-red-400">Reject Dealer</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 text-xl">✕</button>
        </div>
        <p className="text-sm text-slate-400">
          <span className="font-medium text-slate-200">{dealer.name ?? "（名称未設定）"}</span> の申請を拒否します。
        </p>
        <div className="space-y-1.5">
          <label className="text-xs text-slate-500">拒否理由（任意）</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder="審査基準を満たしていないため..."
            className="w-full px-3 py-2 text-sm bg-slate-800 border border-slate-600 rounded-lg text-slate-200 placeholder-slate-600 focus:outline-none focus:border-red-600 resize-none"
          />
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm rounded-lg transition-colors">
            キャンセル
          </button>
          <button
            onClick={() => onReject(reason)}
            disabled={isPending}
            className="px-4 py-2 bg-red-800 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            拒否を確定
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Suspend Modal ─────────────────────────────────────────────────────────────

function SuspendModal({
  dealer, onClose, onSuspend, isPending,
}: { dealer: DealerAdminView; onClose: () => void; onSuspend: (reason: string) => void; isPending: boolean }) {
  const [reason, setReason] = useState("");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-[#0f172a] border border-slate-700 rounded-2xl w-full max-w-md mx-4 p-6 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-orange-400">Suspend Dealer</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 text-xl">✕</button>
        </div>
        <p className="text-sm text-slate-400">
          <span className="font-medium text-slate-200">{dealer.name ?? "（名称未設定）"}</span>{" "}
          のアカウントを停止します。再有効化はいつでも可能です。
        </p>
        <div className="space-y-1.5">
          <label className="text-xs text-slate-500">停止理由（任意）</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder="支払い未履行のため..."
            className="w-full px-3 py-2 text-sm bg-slate-800 border border-slate-600 rounded-lg text-slate-200 placeholder-slate-600 focus:outline-none focus:border-orange-600 resize-none"
          />
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm rounded-lg transition-colors">
            キャンセル
          </button>
          <button
            onClick={() => onSuspend(reason)}
            disabled={isPending}
            className="px-4 py-2 bg-orange-700 hover:bg-orange-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            停止する
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Delete Modal ──────────────────────────────────────────────────────────────

function DeleteModal({
  dealer, onClose, onDelete, isPending,
}: { dealer: DealerAdminView; onClose: () => void; onDelete: () => void; isPending: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-[#0f172a] border border-slate-700 rounded-2xl w-full max-w-md mx-4 p-6 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-red-400">店舗を削除</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 text-xl">✕</button>
        </div>
        <p className="text-sm text-slate-400">
          <span className="font-medium text-slate-200">{dealer.name ?? "（名称未設定）"}</span>
        </p>
        <p className="text-sm text-slate-300">
          このディテーラーを削除しますか？この操作は管理画面から表示されなくなります。
        </p>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm rounded-lg transition-colors">
            キャンセル
          </button>
          <button
            onClick={onDelete}
            disabled={isPending}
            className="px-4 py-2 bg-red-800 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            削除
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Detail Modal ──────────────────────────────────────────────────────────────

function DetailModal({ dealer, onClose }: { dealer: DealerAdminView; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-[#0f172a] border border-slate-700 rounded-2xl w-full max-w-2xl mx-4 overflow-hidden shadow-2xl max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-base font-bold text-slate-100">{dealer.name ?? "（名称未設定）"}</h2>
            <div className="flex items-center gap-2 mt-1">
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${approvalClass(dealer.approval_status)}`}>
                {approvalLabel(dealer.approval_status)}
              </span>
              {dealer.detailer_rank && (
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${rankClass(dealer.detailer_rank)}`}>
                  {rankLabel(dealer.detailer_rank)}
                </span>
              )}
            </div>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 text-xl">✕</button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-6">

          {/* Store Information */}
          <section>
            <h3 className="text-[10px] font-bold text-slate-600 uppercase tracking-widest mb-3">Store Information</h3>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-xs">
              <div><div className="text-slate-500 mb-0.5">店舗名</div><div className="text-slate-200">{dealer.name ?? "—"}</div></div>
              <div><div className="text-slate-500 mb-0.5">現在のプラン</div>
                <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-medium border ${planClass(dealer.plan)}`}>{planLabel(dealer.plan)}</span>
              </div>
              <div><div className="text-slate-500 mb-0.5">登録日</div><div className="text-slate-300">{fmt(dealer.created_at)}</div></div>
              <div><div className="text-slate-500 mb-0.5">サービス開始日</div><div className="text-slate-300">{fmt(dealer.service_start_date)}</div></div>
            </div>
          </section>

          {/* Applicant / Contact */}
          <section>
            <h3 className="text-[10px] font-bold text-slate-600 uppercase tracking-widest mb-3">Contact Information</h3>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-xs">
              <div><div className="text-slate-500 mb-0.5">メール</div><div className="text-slate-300">{dealer.email ?? "—"}</div></div>
              <div><div className="text-slate-500 mb-0.5">電話番号</div><div className="text-slate-300">{dealer.phone ?? "—"}</div></div>
            </div>
          </section>

          {/* Approval / Trial History */}
          <section>
            <h3 className="text-[10px] font-bold text-slate-600 uppercase tracking-widest mb-3">Signup & Approval History</h3>
            <div className="space-y-2 text-xs">
              <div className="flex items-center gap-2 py-2 border-b border-slate-800/60">
                <div className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                <span className="text-slate-500">申請日:</span>
                <span className="text-slate-300">{fmt(dealer.created_at)}</span>
              </div>
              {dealer.approved_at && (
                <div className="flex items-center gap-2 py-2 border-b border-slate-800/60">
                  <div className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
                  <span className="text-slate-500">承認日:</span>
                  <span className="text-slate-300">{fmt(dealer.approved_at)}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded border ${planClass(dealer.trial_plan_type)}`}>
                    {planLabel(dealer.trial_plan_type)} 試用
                  </span>
                </div>
              )}
              {dealer.trial_status === "active" && (
                <div className="flex items-center gap-2 py-2 border-b border-slate-800/60">
                  <div className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                  <span className="text-slate-500">試用終了予定:</span>
                  <span className="text-amber-300 font-medium">{fmt(dealer.trial_end_date)}</span>
                  <TrialCountdown dealer={dealer} />
                </div>
              )}
              {dealer.trial_status === "ended" && (
                <div className="flex items-center gap-2 py-2 border-b border-slate-800/60">
                  <div className="w-2 h-2 rounded-full bg-slate-600 shrink-0" />
                  <span className="text-slate-500">試用終了:</span>
                  <span className="text-slate-400">{fmt(dealer.trial_end_date)}</span>
                  <span className="text-[10px] text-slate-500">→ {planLabel(dealer.auto_downgrade_plan_type)} へ移行</span>
                </div>
              )}
              {dealer.rejection_reason && (
                <div className="flex items-start gap-2 py-2">
                  <div className="w-2 h-2 rounded-full bg-red-500 mt-0.5 shrink-0" />
                  <span className="text-slate-500 shrink-0">
                    {dealer.approval_status === "suspended" ? "停止理由:" : "拒否理由:"}
                  </span>
                  <span className="text-slate-400">{dealer.rejection_reason}</span>
                </div>
              )}
            </div>
          </section>

          {/* Previous Approvals (future-ready) */}
          <section>
            <h3 className="text-[10px] font-bold text-slate-600 uppercase tracking-widest mb-3">
              Previous Approvals <span className="text-slate-700 normal-case font-normal">(coming soon)</span>
            </h3>
            <div className="text-xs text-slate-700 py-2 px-3 bg-slate-900/40 rounded border border-slate-800/60">
              承認履歴テーブルは将来のスプリントで実装予定です。
            </div>
          </section>

          {/* Internal Notes */}
          <section>
            <h3 className="text-[10px] font-bold text-slate-600 uppercase tracking-widest mb-3">Internal Notes</h3>
            {dealer.admin_notes ? (
              <div className="text-xs text-slate-300 bg-slate-800/40 border border-slate-700/50 rounded-lg px-4 py-3 whitespace-pre-wrap">
                {dealer.admin_notes}
              </div>
            ) : (
              <div className="text-xs text-slate-700 py-2 px-3 bg-slate-900/40 rounded border border-slate-800/60">
                内部メモなし
              </div>
            )}
          </section>

          {/* Trial detail */}
          <section>
            <h3 className="text-[10px] font-bold text-slate-600 uppercase tracking-widest mb-3">Trial Configuration</h3>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-xs">
              <div><div className="text-slate-500 mb-0.5">試用プラン</div>
                <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-medium border ${planClass(dealer.trial_plan_type)}`}>
                  {planLabel(dealer.trial_plan_type)}
                </span>
              </div>
              <div><div className="text-slate-500 mb-0.5">自動ダウングレード先</div>
                <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-medium border ${planClass(dealer.auto_downgrade_plan_type)}`}>
                  {planLabel(dealer.auto_downgrade_plan_type)}
                </span>
              </div>
              <div><div className="text-slate-500 mb-0.5">Detailer Rank</div>
                <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-medium border ${rankClass(dealer.detailer_rank)}`}>
                  {rankLabel(dealer.detailer_rank)}
                </span>
              </div>
              <div><div className="text-slate-500 mb-0.5">試用ステータス</div>
                <div className="text-slate-300">{dealer.trial_status ?? "—"}</div>
              </div>
            </div>
          </section>
        </div>

        <div className="px-6 py-4 border-t border-slate-800 flex justify-end shrink-0">
          <button onClick={onClose} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm rounded-lg transition-colors">
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

interface Props {
  dealers: DealerAdminView[];
  callerRole: string;
}

export default function DealersAdminClient({ dealers: initial, callerRole }: Props) {
  const isReadOnly = callerRole === "logistics_admin";
  const isSuperAdmin = callerRole === "super_admin";

  const [dealers,      setDealers]      = useState<DealerAdminView[]>(initial);
  const [search,       setSearch]       = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [planFilter,   setPlanFilter]   = useState<PlanFilter>("all");
  const [trialFilter,  setTrialFilter]  = useState<TrialFilter>("all");
  const [rankFilter,   setRankFilter]   = useState<RankFilter>("all");
  const [modal,        setModal]        = useState<Modal>({ type: "none" });
  const [toast,        setToast]        = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [isPending,    startTransition] = useTransition();

  const showToast = (message: string, type: "success" | "error") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Stats
  const stats = useMemo(() => ({
    pending:      dealers.filter((d) => !d.approval_status || d.approval_status === "pending").length,
    approved:     dealers.filter((d) => d.approval_status === "approved").length,
    rejected:     dealers.filter((d) => d.approval_status === "rejected").length,
    suspended:    dealers.filter((d) => d.approval_status === "suspended").length,
    activeTrials: dealers.filter((d) => d.trial_status === "active").length,
  }), [dealers]);

  // Filtered list
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return dealers.filter((d) => {
      if (q) {
        const text = [d.name, d.email, d.phone, d.detailer_rank, d.plan, d.approval_status].join(" ").toLowerCase();
        if (!text.includes(q)) return false;
      }
      const st = d.approval_status ?? "pending";
      if (statusFilter !== "all") {
        if (statusFilter === "pending" && st !== "pending" && d.approval_status !== null) return false;
        if (statusFilter !== "pending" && st !== statusFilter) return false;
      }
      if (planFilter !== "all"  && d.plan !== planFilter)                    return false;
      if (trialFilter !== "all" && (d.trial_status ?? "none") !== trialFilter) return false;
      if (rankFilter !== "all"  && normalizeRank(d.detailer_rank) !== rankFilter) return false;
      return true;
    });
  }, [dealers, search, statusFilter, planFilter, trialFilter, rankFilter]);

  // ── Action handlers ────────────────────────────────────────────────────────

  const handleApprove = (dealer: DealerAdminView, opts: {
    detailerRank: string; initialPlan: string; serviceStartDate: string; trialEndDate: string;
  }) => {
    setModal({ type: "none" });
    startTransition(async () => {
      const result = await approveDealerTrial(dealer.id, {
        detailerRank:    opts.detailerRank,
        initialPlan:     opts.initialPlan,
        serviceStartDate: opts.serviceStartDate,
        trialEndDate:    opts.trialEndDate,
      });
      if (result.success) {
        setDealers((prev) => prev.map((d) => d.id === dealer.id ? {
          ...d,
          approval_status:          "approved",
          plan:                     opts.initialPlan,
          subscription_status:      "trial",
          trial_status:             "active",
          trial_plan_type:          opts.initialPlan,
          service_start_date:       opts.serviceStartDate,
          trial_start_date:         opts.serviceStartDate,
          trial_end_date:           opts.trialEndDate,
          auto_downgrade_plan_type: "basic",
          detailer_rank:            opts.detailerRank,
        } : d));
        showToast(`${dealer.name ?? "ディーラー"} を承認しました`, "success");
      } else {
        showToast(result.error ?? "エラーが発生しました", "error");
      }
    });
  };

  const handleReject = (dealer: DealerAdminView, reason: string) => {
    setModal({ type: "none" });
    startTransition(async () => {
      const result = await rejectDealer(dealer.id, reason);
      if (result.success) {
        setDealers((prev) => prev.map((d) => d.id === dealer.id ? {
          ...d, approval_status: "rejected", rejection_reason: reason,
        } : d));
        showToast(`${dealer.name ?? "ディーラー"} を拒否しました`, "success");
      } else {
        showToast(result.error ?? "エラーが発生しました", "error");
      }
    });
  };

  const handleSuspend = (dealer: DealerAdminView, reason: string) => {
    setModal({ type: "none" });
    startTransition(async () => {
      const result = await suspendDealer(dealer.id, reason);
      if (result.success) {
        setDealers((prev) => prev.map((d) => d.id === dealer.id ? {
          ...d, approval_status: "suspended", subscription_status: "suspended",
          rejection_reason: reason,
        } : d));
        showToast(`${dealer.name ?? "ディーラー"} を停止しました`, "success");
      } else {
        showToast(result.error ?? "エラーが発生しました", "error");
      }
    });
  };

  const handleDelete = (dealer: DealerAdminView) => {
    setModal({ type: "none" });
    startTransition(async () => {
      const result = await deleteDealer(dealer.id);
      if (result.success) {
        // Soft-deleted — remove from the active list (other dealers untouched)
        setDealers((prev) => prev.filter((d) => d.id !== dealer.id));
        showToast(`${dealer.name ?? "ディーラー"} を削除しました`, "success");
      } else {
        showToast(result.error ?? "エラーが発生しました", "error");
      }
    });
  };

  const handleReactivate = (dealer: DealerAdminView) => {
    startTransition(async () => {
      const result = await reactivateDealer(dealer.id);
      if (result.success) {
        const trialActive =
          dealer.trial_status === "active" &&
          dealer.trial_end_date &&
          dealer.trial_end_date >= today();
        setDealers((prev) => prev.map((d) => d.id === dealer.id ? {
          ...d,
          approval_status:     "approved",
          subscription_status: trialActive ? "trial" : "active",
          rejection_reason:    null,
        } : d));
        showToast(`${dealer.name ?? "ディーラー"} を再有効化しました`, "success");
      } else {
        showToast(result.error ?? "エラーが発生しました", "error");
      }
    });
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">

      {/* Toast */}
      {toast && (
        <div className={`fixed top-16 right-4 z-50 px-4 py-2 rounded-lg text-sm font-medium shadow-lg max-w-sm ${
          toast.type === "success"
            ? "bg-green-900 text-green-200 border border-green-700"
            : "bg-red-900 text-red-200 border border-red-700"
        }`}>
          {toast.message}
        </div>
      )}

      {/* ── Header + Search ─────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-lg font-semibold text-slate-100">Dealer Approval Center</h1>
          <p className="text-xs text-slate-500 mt-0.5">{dealers.length} 件 — 全ディーラー</p>
        </div>
        <input
          type="text"
          placeholder="店舗名・メール・ランク・プランで検索..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-72 px-3 py-1.5 text-xs bg-[#0f172a] border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-slate-500"
        />
      </div>

      {/* ── Stats row ───────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2">
        {stats.pending > 0 && (
          <span className="inline-flex items-center gap-1.5 text-xs px-3 py-1 rounded-full bg-amber-900/30 text-amber-300 border border-amber-700/40">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            承認待ち {stats.pending}件
          </span>
        )}
        <span className="text-xs px-3 py-1 rounded-full bg-green-900/20 text-green-400 border border-green-800/40">
          承認済み {stats.approved}件
        </span>
        {stats.activeTrials > 0 && (
          <span className="text-xs px-3 py-1 rounded-full bg-blue-900/20 text-blue-400 border border-blue-800/40">
            試用中 {stats.activeTrials}件
          </span>
        )}
        {stats.suspended > 0 && (
          <span className="text-xs px-3 py-1 rounded-full bg-orange-900/20 text-orange-400 border border-orange-800/40">
            停止中 {stats.suspended}件
          </span>
        )}
        {stats.rejected > 0 && (
          <span className="text-xs px-3 py-1 rounded-full bg-red-900/20 text-red-400 border border-red-800/40">
            拒否済み {stats.rejected}件
          </span>
        )}
      </div>

      {/* ── Filters ─────────────────────────────────────────────────────── */}
      <div className="space-y-2">
        {/* Status filter */}
        <div className="flex flex-wrap gap-1">
          {(["all", "pending", "approved", "rejected", "suspended"] as StatusFilter[]).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`text-[10px] px-3 py-1 rounded-full border transition-colors ${
                statusFilter === s
                  ? s === "pending"   ? "bg-amber-700/30 text-amber-300 border-amber-600/50"
                  : s === "approved"  ? "bg-green-700/30 text-green-300 border-green-600/50"
                  : s === "rejected"  ? "bg-red-700/30   text-red-300   border-red-600/50"
                  : s === "suspended" ? "bg-orange-700/30 text-orange-300 border-orange-600/50"
                  : "bg-slate-700/40 text-slate-300 border-slate-600/50"
                  : "text-slate-500 border-slate-700/50 hover:border-slate-600"
              }`}
            >
              {s === "all" ? "All" : s === "pending" ? "Pending" : s === "approved" ? "Approved" : s === "rejected" ? "Rejected" : "Suspended"}
            </button>
          ))}
        </div>

        {/* Plan + trial + rank filter */}
        <div className="flex flex-wrap gap-1">
          {(["all", "pro_plus", "pro", "basic"] as PlanFilter[]).map((p) => (
            <button
              key={p}
              onClick={() => setPlanFilter(p)}
              className={`text-[10px] px-2.5 py-1 rounded-full border transition-colors ${
                planFilter === p
                  ? p === "pro_plus" ? "bg-purple-700/30 text-purple-300 border-purple-600/50"
                  : p === "pro"      ? "bg-blue-700/30   text-blue-300   border-blue-600/50"
                  : p === "basic"    ? "bg-slate-700/60  text-slate-300  border-slate-600/60"
                  : "bg-slate-700/40 text-slate-300 border-slate-600/50"
                  : "text-slate-600 border-slate-800 hover:border-slate-700"
              }`}
            >
              {p === "all" ? "All plans" : planLabel(p)}
            </button>
          ))}
          <span className="text-slate-800 text-xs px-1">|</span>
          {(["all", "active", "ended", "none"] as TrialFilter[]).map((t) => (
            <button
              key={t}
              onClick={() => setTrialFilter(t)}
              className={`text-[10px] px-2.5 py-1 rounded-full border transition-colors ${
                trialFilter === t
                  ? "bg-amber-700/20 text-amber-300 border-amber-700/40"
                  : "text-slate-600 border-slate-800 hover:border-slate-700"
              }`}
            >
              {t === "all" ? "All trials" : t === "active" ? "Trial active" : t === "ended" ? "Trial ended" : "No trial"}
            </button>
          ))}
          <span className="text-slate-800 text-xs px-1">|</span>
          {(["all", "shop", "detailer", "certified"] as RankFilter[]).map((r) => (
            <button
              key={r}
              onClick={() => setRankFilter(r)}
              className={`text-[10px] px-2.5 py-1 rounded-full border transition-colors ${
                rankFilter === r
                  ? r === "certified" ? "bg-amber-700/20 text-amber-300 border-amber-700/40"
                  : r === "detailer"           ? "bg-sky-700/20   text-sky-300   border-sky-700/40"
                  : "bg-slate-700/40 text-slate-300 border-slate-600/50"
                  : "text-slate-600 border-slate-800 hover:border-slate-700"
              }`}
            >
              {r === "all" ? "All ranks" : rankLabel(r)}
            </button>
          ))}
          <span className="text-xs text-slate-600 ml-auto">{filtered.length}件</span>
        </div>
      </div>

      {/* ── Dealer Table ─────────────────────────────────────────────────── */}
      <div className="bg-[#0b1120] border border-slate-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-800">
                {["店舗", "ランク", "プラン", "ステータス", "試用", "登録日", "操作"].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-[10px] font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/40">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-600">
                    {search || statusFilter !== "all" || planFilter !== "all" || trialFilter !== "all" || rankFilter !== "all"
                      ? "該当するディーラーが見つかりません"
                      : "ディーラーがいません"}
                  </td>
                </tr>
              ) : (
                filtered.map((dealer) => {
                  const st = dealer.approval_status ?? "pending";
                  const isPending_ = !dealer.approval_status || st === "pending";
                  return (
                    <tr
                      key={dealer.id}
                      className={`hover:bg-slate-800/20 transition-colors ${isPending_ ? "bg-amber-950/10" : ""}`}
                    >
                      {/* Store */}
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setModal({ type: "detail", dealer })}
                          className="text-left group"
                        >
                          <div className="font-medium text-slate-200 group-hover:text-blue-400 transition-colors">
                            {dealer.name ?? "（名称未設定）"}
                          </div>
                          <div className="text-slate-500 text-[10px] mt-0.5">{dealer.email ?? "—"}</div>
                        </button>
                      </td>

                      {/* Rank */}
                      <td className="px-4 py-3">
                        {dealer.detailer_rank ? (
                          <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-medium border ${rankClass(dealer.detailer_rank)}`}>
                            {rankLabel(dealer.detailer_rank)}
                          </span>
                        ) : (
                          <span className="text-slate-700">—</span>
                        )}
                      </td>

                      {/* Plan */}
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-medium border ${planClass(dealer.plan)}`}>
                          {planLabel(dealer.plan)}
                        </span>
                      </td>

                      {/* Approval status */}
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-medium border ${approvalClass(st)}`}>
                          {approvalLabel(st)}
                        </span>
                      </td>

                      {/* Trial countdown */}
                      <td className="px-4 py-3">
                        <TrialCountdown dealer={dealer} />
                      </td>

                      {/* Registered */}
                      <td className="px-4 py-3 text-slate-500">{fmt(dealer.created_at)}</td>

                      {/* Actions */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 flex-wrap">
                          {/* Detail button — always (opens panel in read-only for logistics_admin) */}
                          <button
                            onClick={() => setModal({ type: "detail", dealer })}
                            className="text-[10px] px-2 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded transition-colors"
                          >
                            詳細
                          </button>

                          {/* Pending → Approve + Reject (super_admin + gyeon_admin only) */}
                          {isPending_ && !isReadOnly && (
                            <>
                              <button
                                onClick={() => setModal({ type: "approve", dealer })}
                                disabled={isPending}
                                className="text-[10px] px-2 py-1 bg-green-800/60 hover:bg-green-700/60 text-green-300 rounded transition-colors disabled:opacity-50"
                              >
                                承認
                              </button>
                              <button
                                onClick={() => setModal({ type: "reject", dealer })}
                                disabled={isPending}
                                className="text-[10px] px-2 py-1 bg-red-900/50 hover:bg-red-800/60 text-red-300 rounded transition-colors disabled:opacity-50"
                              >
                                拒否
                              </button>
                            </>
                          )}

                          {/* Approved → Suspend (super_admin + gyeon_admin only) */}
                          {st === "approved" && !isReadOnly && (
                            <button
                              onClick={() => setModal({ type: "suspend", dealer })}
                              disabled={isPending}
                              className="text-[10px] px-2 py-1 bg-orange-900/40 hover:bg-orange-800/50 text-orange-300 rounded transition-colors disabled:opacity-50"
                            >
                              停止
                            </button>
                          )}

                          {/* Suspended → Re-activate (super_admin + gyeon_admin only) */}
                          {st === "suspended" && !isReadOnly && (
                            <button
                              onClick={() => handleReactivate(dealer)}
                              disabled={isPending}
                              className="text-[10px] px-2 py-1 bg-green-900/40 hover:bg-green-800/50 text-green-300 rounded transition-colors disabled:opacity-50"
                            >
                              再有効化
                            </button>
                          )}

                          {/* Delete — soft delete (super_admin only) */}
                          {isSuperAdmin && (
                            <button
                              onClick={() => setModal({ type: "delete", dealer })}
                              disabled={isPending}
                              className="text-[10px] px-2 py-1 bg-red-950/60 hover:bg-red-900/70 text-red-400 rounded transition-colors disabled:opacity-50"
                            >
                              削除
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Modals ──────────────────────────────────────────────────────── */}
      {modal.type === "approve" && (
        <ApproveModal
          dealer={modal.dealer}
          onClose={() => setModal({ type: "none" })}
          onApprove={(opts) => handleApprove(modal.dealer, opts)}
          isPending={isPending}
        />
      )}
      {modal.type === "reject" && (
        <RejectModal
          dealer={modal.dealer}
          onClose={() => setModal({ type: "none" })}
          onReject={(reason) => handleReject(modal.dealer, reason)}
          isPending={isPending}
        />
      )}
      {modal.type === "suspend" && (
        <SuspendModal
          dealer={modal.dealer}
          onClose={() => setModal({ type: "none" })}
          onSuspend={(reason) => handleSuspend(modal.dealer, reason)}
          isPending={isPending}
        />
      )}
      {modal.type === "delete" && (
        <DeleteModal
          dealer={modal.dealer}
          onClose={() => setModal({ type: "none" })}
          onDelete={() => handleDelete(modal.dealer)}
          isPending={isPending}
        />
      )}
      {modal.type === "detail" && (
        <DealerDetailPanel
          dealer={modal.dealer}
          callerRole={callerRole}
          onClose={() => setModal({ type: "none" })}
          onDealerUpdate={(dealerId, update) => {
            setDealers((prev) =>
              prev.map((d) => d.id === dealerId ? { ...d, ...update } : d)
            );
          }}
        />
      )}
    </div>
  );
}
