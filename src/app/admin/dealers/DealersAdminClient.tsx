"use client";

import { useState, useTransition, useMemo } from "react";
import { approveDealerTrial, rejectDealer, suspendDealer, reactivateDealer, deleteDealer, restoreDealer, purgeDealer } from "@/lib/admin/approve-dealer";
import DealerDetailPanel from "./DealerDetailPanel";
import type { DealerAdminView } from "@/lib/admin/admin-types";
import { DEALER_RANKS, DEALER_RANK_VALUES, normalizeRank, rankLabelOrDash, DEFAULT_DEALER_RANK } from "@/lib/ranks/dealer-ranks";
import {
  listGyeonProvisioning,
  createGyeonProvisioning,
  sendGyeonProvisioningInvite,
  resendGyeonProvisioningInvite,
  reconcileGyeonProvisioningInvite,
  revokeGyeonProvisioning,
} from "@/lib/admin/gyeon-provisioning-actions";
import { dryRunGyeonProvisioningCsv, confirmGyeonProvisioningCsv } from "@/lib/admin/gyeon-provisioning-csv";
import { GYEON_PROVISIONING_RANKS, type GyeonProvisioningAdminRow } from "@/lib/admin/gyeon-provisioning-csv-core";

type StatusFilter = "all" | "pending" | "approved" | "rejected" | "suspended";
type PlanFilter   = "all" | "basic" | "pro" | "pro_plus";
type TrialFilter  = "all" | "active" | "ended" | "none";
type RankFilter   = string; // "all" | any DealerRank value (profile-driven)

type Modal =
  | { type: "none" }
  | { type: "approve";    dealer: DealerAdminView }
  | { type: "reject";     dealer: DealerAdminView }
  | { type: "suspend";    dealer: DealerAdminView }
  | { type: "delete";     dealer: DealerAdminView }
  | { type: "purge";      dealer: DealerAdminView }
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
    case "certified":     return "text-amber-300   bg-amber-900/30   border-amber-700/40";
    case "ppf_installer": return "text-violet-300  bg-violet-900/30  border-violet-700/40";
    case "detailer":      return "text-sky-300     bg-sky-900/30     border-sky-700/40";
    case "shop":          return "text-emerald-300 bg-emerald-900/30 border-emerald-700/40";
    default:              return "text-slate-600 bg-transparent  border-transparent";
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
            <h2 className="text-base font-bold text-slate-100">店舗を承認</h2>
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
            <label className="text-xs font-medium text-slate-400 block mb-2">ディテーラーランク</label>
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
              初期プラン <span className="text-slate-600 font-normal">(既定: Pro Plus)</span>
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
                サービス開始日
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
                試用期間 <span className="text-slate-600 font-normal">(日数)</span>
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
            <span className="text-xs text-slate-500">試用終了（自動計算）</span>
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
          <h2 className="text-base font-bold text-red-400">店舗を却下</h2>
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
          <h2 className="text-base font-bold text-orange-400">店舗を停止</h2>
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
          <h2 className="text-base font-bold text-orange-400">店舗をアーカイブ</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 text-xl">✕</button>
        </div>
        <p className="text-sm text-slate-400">
          <span className="font-medium text-slate-200">{dealer.name ?? "（名称未設定）"}</span>
        </p>
        <p className="text-sm text-slate-300">
          このディーラーをアーカイブします。管理画面の一覧から非表示になり、
          オーナー・スタッフはログインできなくなります（メンバーは停止されます）。
          データは保持され、あとで「アーカイブ済み」から復元できます。
        </p>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm rounded-lg transition-colors">
            キャンセル
          </button>
          <button
            onClick={onDelete}
            disabled={isPending}
            className="px-4 py-2 bg-orange-700 hover:bg-orange-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            アーカイブ
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Purge (完全削除) Modal — typed confirmation, irreversible ──────────────────

const PURGE_CONFIRMATION_LITERAL = "DELETE";

function PurgeModal({
  dealer, onClose, onPurge, isPending,
}: { dealer: DealerAdminView; onClose: () => void; onPurge: () => void; isPending: boolean }) {
  const [confirmation, setConfirmation] = useState("");

  const handleClose = () => {
    setConfirmation("");
    onClose();
  };

  const canPurge = confirmation === PURGE_CONFIRMATION_LITERAL && !isPending;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-[#0f172a] border border-red-800/60 rounded-2xl w-full max-w-md mx-4 p-6 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-red-400">完全削除</h2>
          <button onClick={handleClose} className="text-slate-500 hover:text-slate-300 text-xl">✕</button>
        </div>
        <p className="text-sm text-slate-400">
          <span className="font-medium text-slate-200">{dealer.name ?? "（名称未設定）"}</span>
        </p>
        <p className="text-sm text-red-300">
          このディーラーを完全削除します。この操作は取り消せません。関連するディーラーデータに連鎖して削除が及ぶ場合があり、オーナーのAuthアカウントも削除される可能性があります。
        </p>
        <div className="space-y-1.5">
          <label className="text-xs text-slate-500">
            確認のため <span className="font-mono text-red-300">{PURGE_CONFIRMATION_LITERAL}</span> と入力してください
          </label>
          <input
            type="text"
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
            placeholder={PURGE_CONFIRMATION_LITERAL}
            className="w-full px-3 py-2 text-sm bg-slate-800 border border-slate-600 rounded-lg text-slate-200 placeholder-slate-600 font-mono focus:outline-none focus:border-red-600"
          />
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={handleClose} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm rounded-lg transition-colors">
            キャンセル
          </button>
          <button
            onClick={onPurge}
            disabled={!canPurge}
            className="px-4 py-2 bg-red-700 hover:bg-red-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            完全削除
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
            <h3 className="text-[10px] font-bold text-slate-600 uppercase tracking-widest mb-3">店舗情報</h3>
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
            <h3 className="text-[10px] font-bold text-slate-600 uppercase tracking-widest mb-3">連絡先</h3>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-xs">
              <div><div className="text-slate-500 mb-0.5">メール</div><div className="text-slate-300">{dealer.email ?? "—"}</div></div>
              <div><div className="text-slate-500 mb-0.5">電話番号</div><div className="text-slate-300">{dealer.phone ?? "—"}</div></div>
            </div>
          </section>

          {/* Approval / Trial History */}
          <section>
            <h3 className="text-[10px] font-bold text-slate-600 uppercase tracking-widest mb-3">登録・承認履歴</h3>
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
              過去の承認履歴 <span className="text-slate-700 normal-case font-normal">(準備中)</span>
            </h3>
            <div className="text-xs text-slate-700 py-2 px-3 bg-slate-900/40 rounded border border-slate-800/60">
              承認履歴テーブルは将来のスプリントで実装予定です。
            </div>
          </section>

          {/* Internal Notes */}
          <section>
            <h3 className="text-[10px] font-bold text-slate-600 uppercase tracking-widest mb-3">社内メモ</h3>
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
            <h3 className="text-[10px] font-bold text-slate-600 uppercase tracking-widest mb-3">試用設定</h3>
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
              <div><div className="text-slate-500 mb-0.5">ディテーラーランク</div>
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

// ── GYEON Partner Provisioning Panel (super_admin + server gate only) ─────────
// The panel exists ONLY when the server passed partnerOnboarding=true (the
// server-only GYEON_PARTNER_ONBOARDING_ENABLED gate + super_admin); every
// action re-validates both server-side, so this rendering flag is UX, never
// authorization.

function provisioningStateLabel(row: GyeonProvisioningAdminRow): { text: string; cls: string } {
  if (row.provisioningStatus === "claimed") return { text: "有効化済み", cls: "text-green-300 bg-green-900/30 border-green-700/40" };
  if (row.provisioningStatus === "revoked") return { text: "取消済み", cls: "text-red-300 bg-red-900/30 border-red-700/40" };
  switch (row.invitationState) {
    case "none":          return { text: "未招待", cls: "text-slate-400 bg-slate-800/60 border-slate-700/40" };
    case "pending":       return { text: "送信結果未確認", cls: "text-amber-300 bg-amber-900/30 border-amber-700/40" };
    case "sent":          return { text: "招待送信済み", cls: "text-sky-300 bg-sky-900/30 border-sky-700/40" };
    case "failed":        return { text: "送信失敗", cls: "text-red-300 bg-red-900/30 border-red-700/40" };
    case "awaiting_claim": return { text: "既存アカウント（ログイン待ち）", cls: "text-violet-300 bg-violet-900/30 border-violet-700/40" };
  }
}

function GyeonProvisioningPanel({ initialRows }: { initialRows: GyeonProvisioningAdminRow[] }) {
  const [rows, setRows] = useState<GyeonProvisioningAdminRow[]>(initialRows);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [busy, startBusy] = useTransition();

  // Single create
  const [newEmail, setNewEmail] = useState("");
  const [newShop, setNewShop] = useState("");
  const [newRank, setNewRank] = useState<string>("shop");
  const [newCode, setNewCode] = useState("");

  // CSV import
  const [csvText, setCsvText] = useState("");
  const [csvPreview, setCsvPreview] = useState<string | null>(null);

  const say = (text: string, type: "success" | "error") => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 6000);
  };

  const refresh = async () => {
    const result = await listGyeonProvisioning();
    if (result.kind === "ok") setRows(result.rows);
  };

  const handleCreate = () => {
    startBusy(async () => {
      const result = await createGyeonProvisioning({
        email: newEmail, shopName: newShop, detailerRank: newRank, dealerCode: newCode,
      });
      if (result.kind === "created") {
        setNewEmail(""); setNewShop(""); setNewCode("");
        say("登録しました（招待は未送信です）", "success");
        await refresh();
      } else if (result.kind === "conflict") {
        say("同じメールまたはコードの登録が既に存在します", "error");
      } else if (result.kind === "invalid-input") {
        say(result.reasonJa, "error");
      } else {
        say("登録に失敗しました", "error");
      }
    });
  };

  const handleDryRun = () => {
    startBusy(async () => {
      const result = await dryRunGyeonProvisioningCsv(csvText);
      if (result.kind === "ok") {
        setCsvPreview(
          `検証OK: ${result.rows.length}件` +
          (result.conflicts.length > 0
            ? ` / 競合 ${result.conflicts.length}件: ${result.conflicts.map((c) => c.email).join(", ")}`
            : " / 競合なし"),
        );
      } else if (result.kind === "invalid") {
        setCsvPreview(`エラー ${result.errors.length}件: ` + result.errors.slice(0, 5).map((e) => `行${e.rowNumber} ${e.code}`).join(", "));
      } else {
        setCsvPreview("検証に失敗しました");
      }
    });
  };

  const handleImport = () => {
    startBusy(async () => {
      const result = await confirmGyeonProvisioningCsv(csvText);
      if (result.kind === "imported") {
        setCsvText(""); setCsvPreview(null);
        say(`${result.count}件を取り込みました（招待は未送信です）`, "success");
        await refresh();
      } else if (result.kind === "conflict") {
        say(`競合のため全件中止: ${result.conflicts.map((c) => c.email).join(", ")}`, "error");
      } else if (result.kind === "invalid") {
        say("CSVにエラーがあります。検証結果を確認してください", "error");
      } else {
        say("取り込みに失敗しました", "error");
      }
    });
  };

  const runRowAction = (
    label: string,
    fn: () => Promise<{ kind: string }>,
  ) => {
    startBusy(async () => {
      const result = await fn();
      if (["sent", "awaiting-claim", "revoked", "settled-sent", "settled-awaiting-claim", "settled-failed"].includes(result.kind)) {
        say(`${label}: 完了（${result.kind}）`, "success");
      } else if (result.kind === "uncertain") {
        say(`${label}: 送信結果を確認できませんでした。「状態照合」で確定してください（自動再送はされません）`, "error");
      } else if (result.kind === "failed") {
        say(`${label}: 送信失敗として記録しました（再送可能）`, "error");
      } else if (result.kind === "reconcile-required") {
        say(`${label}: 先に「状態照合」で結果を確定してください`, "error");
      } else {
        say(`${label}: 実行できませんでした（${result.kind}）`, "error");
      }
      await refresh();
    });
  };

  return (
    <div className="space-y-2 pt-2" data-testid="gyeon-provisioning-panel">
      <h2 className="text-sm font-semibold text-slate-300">
        GYEONパートナー事前登録 {rows.length}件
      </h2>
      <p className="text-[11px] text-slate-600">
        登録済みメールでの本人認証（メール確認）完了時に自動で店舗が有効化されます。
        取り込み・登録だけでは招待メールは送信されません。招待は行ごとに明示的に送信します。
      </p>

      {message && (
        <p className={`text-xs ${message.type === "success" ? "text-green-300" : "text-red-300"}`} role="status">
          {message.text}
        </p>
      )}

      {/* Single create */}
      <div className="bg-[#0b1120] border border-slate-800 rounded-xl p-4 flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1">
          <label className="text-[10px] text-slate-500">代表者メール</label>
          <input value={newEmail} onChange={(e) => setNewEmail(e.target.value)}
            className="bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-xs text-slate-200 w-52" placeholder="owner@example.com" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] text-slate-500">店舗名</label>
          <input value={newShop} onChange={(e) => setNewShop(e.target.value)}
            className="bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-xs text-slate-200 w-44" placeholder="GYEON ○○" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] text-slate-500">ランク</label>
          <select value={newRank} onChange={(e) => setNewRank(e.target.value)}
            className="bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-xs text-slate-200">
            {GYEON_PROVISIONING_RANKS.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] text-slate-500">ディーラーコード（任意）</label>
          <input value={newCode} onChange={(e) => setNewCode(e.target.value)}
            className="bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-xs text-slate-200 w-32" />
        </div>
        <button onClick={handleCreate} disabled={busy}
          className="text-xs px-3 py-1.5 bg-blue-900/40 hover:bg-blue-800/50 text-blue-300 rounded transition-colors disabled:opacity-50">
          店舗を登録
        </button>
      </div>

      {/* CSV import */}
      <div className="bg-[#0b1120] border border-slate-800 rounded-xl p-4 space-y-2">
        <label className="text-[10px] text-slate-500">
          CSV取込（ヘッダー: representative_email, shop_name, detailer_rank, dealer_code任意）
        </label>
        <textarea value={csvText} onChange={(e) => setCsvText(e.target.value)} rows={4}
          className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-xs text-slate-200 font-mono"
          placeholder={"representative_email,shop_name,detailer_rank,dealer_code\nowner@example.com,GYEON ○○,shop,GY-001"} />
        {csvPreview && <p className="text-[11px] text-slate-400">{csvPreview}</p>}
        <div className="flex gap-2">
          <button onClick={handleDryRun} disabled={busy || csvText.trim() === ""}
            className="text-xs px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded transition-colors disabled:opacity-50">
            検証（書き込みなし）
          </button>
          <button onClick={handleImport} disabled={busy || csvText.trim() === ""}
            className="text-xs px-3 py-1.5 bg-blue-900/40 hover:bg-blue-800/50 text-blue-300 rounded transition-colors disabled:opacity-50">
            取込確定
          </button>
        </div>
      </div>

      {/* Rows */}
      <div className="bg-[#0b1120] border border-slate-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-800">
                {["メール", "店舗名", "ランク", "コード", "状態", "操作"].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-[10px] font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/40">
              {rows.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-600">事前登録はまだありません</td></tr>
              ) : rows.map((row) => {
                const badge = provisioningStateLabel(row);
                const registered = row.provisioningStatus === "registered";
                return (
                  <tr key={row.id} className="hover:bg-slate-800/20 transition-colors">
                    <td className="px-4 py-3 text-slate-300">{row.emailNormalized}</td>
                    <td className="px-4 py-3 text-slate-300">{row.shopName}</td>
                    <td className="px-4 py-3 text-slate-400">{row.detailerRank}</td>
                    <td className="px-4 py-3 text-slate-500">{row.dealerCode ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block text-[10px] px-2 py-0.5 rounded border ${badge.cls}`}>{badge.text}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 flex-wrap">
                        {registered && row.invitationState === "none" && (
                          <button onClick={() => runRowAction("招待送信", () => sendGyeonProvisioningInvite(row.id))} disabled={busy}
                            className="text-[10px] px-2 py-1 bg-blue-900/40 hover:bg-blue-800/50 text-blue-300 rounded transition-colors disabled:opacity-50">
                            招待送信
                          </button>
                        )}
                        {registered && (row.invitationState === "failed" || row.invitationState === "sent") && (
                          <button onClick={() => runRowAction("再送", () => resendGyeonProvisioningInvite(row.id))} disabled={busy}
                            className="text-[10px] px-2 py-1 bg-blue-900/40 hover:bg-blue-800/50 text-blue-300 rounded transition-colors disabled:opacity-50">
                            再送
                          </button>
                        )}
                        {registered && row.invitationState === "pending" && (
                          <button onClick={() => runRowAction("状態照合", () => reconcileGyeonProvisioningInvite(row.id))} disabled={busy}
                            className="text-[10px] px-2 py-1 bg-amber-900/40 hover:bg-amber-800/50 text-amber-300 rounded transition-colors disabled:opacity-50">
                            状態照合
                          </button>
                        )}
                        {registered && (
                          <button onClick={() => runRowAction("取消", () => revokeGyeonProvisioning(row.id))} disabled={busy}
                            className="text-[10px] px-2 py-1 bg-red-900/40 hover:bg-red-800/50 text-red-300 rounded transition-colors disabled:opacity-50">
                            取消
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

interface Props {
  dealers: DealerAdminView[];
  archived: DealerAdminView[];
  protectedOwnerIds: string[];
  callerRole: string;
  partnerOnboarding?: boolean;
  provisioning?: GyeonProvisioningAdminRow[] | null;
}

export default function DealersAdminClient({ dealers: initial, archived: initialArchived, protectedOwnerIds, callerRole, partnerOnboarding = false, provisioning = null }: Props) {
  const isReadOnly = callerRole === "logistics_admin";
  const isSuperAdmin = callerRole === "super_admin";

  const [dealers,      setDealers]      = useState<DealerAdminView[]>(initial);
  const [archived,     setArchived]     = useState<DealerAdminView[]>(initialArchived);
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
        // Soft-archived — move it from the active list into the archived list
        // so it can be restored or 完全削除 (purged) from there.
        setDealers((prev) => prev.filter((d) => d.id !== dealer.id));
        setArchived((prev) => [{ ...dealer, deleted_at: new Date().toISOString() }, ...prev]);
        showToast(`${dealer.name ?? "ディーラー"} をアーカイブしました`, "success");
      } else {
        showToast(result.error ?? "エラーが発生しました", "error");
      }
    });
  };

  // Permanently delete an archived dealer (完全削除) — irreversible; reuses the
  // safe hard-delete for the owner auth user via the server action.
  const handlePurge = (dealer: DealerAdminView) => {
    setModal({ type: "none" });
    startTransition(async () => {
      const result = await purgeDealer(dealer.id);
      if (result.success) {
        setArchived((prev) => prev.filter((d) => d.id !== dealer.id));
        setDealers((prev) => prev.filter((d) => d.id !== dealer.id));
        showToast(`${dealer.name ?? "ディーラー"} を完全削除しました`, "success");
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

  // Restore an archived (soft-deleted) dealer and re-activate its members.
  const handleRestore = (dealer: DealerAdminView) => {
    startTransition(async () => {
      const result = await restoreDealer(dealer.id);
      if (result.success) {
        setArchived((prev) => prev.filter((d) => d.id !== dealer.id));
        setDealers((prev) => [
          { ...dealer, approval_status: "approved", rejection_reason: null },
          ...prev,
        ]);
        showToast(`${dealer.name ?? "ディーラー"} を復元しました`, "success");
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
          <h1 className="text-lg font-semibold text-slate-100">店舗管理</h1>
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
              {s === "all" ? "すべて" : s === "pending" ? "承認待ち" : s === "approved" ? "承認済み" : s === "rejected" ? "却下" : "停止中"}
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
              {p === "all" ? "すべてのプラン" : planLabel(p)}
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
              {t === "all" ? "すべての試用" : t === "active" ? "試用中" : t === "ended" ? "試用終了" : "試用なし"}
            </button>
          ))}
          <span className="text-slate-800 text-xs px-1">|</span>
          {(["all", ...DEALER_RANK_VALUES] as RankFilter[]).map((r) => (
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
              {r === "all" ? "すべてのランク" : rankLabel(r)}
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
                {["店舗", "メール", "ランク", "プラン", "試用", "Owner数", "Staff数", "ステータス", "登録日", "操作"].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-[10px] font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/40">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center text-slate-600">
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

                      {/* Email */}
                      <td className="px-4 py-3 text-slate-400">{dealer.email ?? "—"}</td>

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

                      {/* Trial countdown */}
                      <td className="px-4 py-3">
                        <TrialCountdown dealer={dealer} />
                      </td>

                      {/* Owner count */}
                      <td className="px-4 py-3 text-slate-400">{dealer.owner_user_id ? 1 : 0}</td>

                      {/* Staff count */}
                      <td className="px-4 py-3 text-slate-400">{dealer.staff_count ?? 0}</td>

                      {/* Approval status */}
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-medium border ${approvalClass(st)}`}>
                          {approvalLabel(st)}
                        </span>
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

                          {/* Archive — soft delete (super_admin only) */}
                          {isSuperAdmin && (
                            <button
                              onClick={() => setModal({ type: "delete", dealer })}
                              disabled={isPending}
                              className="text-[10px] px-2 py-1 bg-orange-950/60 hover:bg-orange-900/70 text-orange-400 rounded transition-colors disabled:opacity-50"
                            >
                              アーカイブ
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

      {/* ── GYEON partner provisioning (server gate + super_admin only) ── */}
      {isSuperAdmin && partnerOnboarding && provisioning !== null && (
        <GyeonProvisioningPanel initialRows={provisioning} />
      )}

      {/* ── Archived (soft-deleted) dealers — restore path (super_admin only) ── */}
      {isSuperAdmin && archived.length > 0 && (
        <div className="space-y-2 pt-2">
          <h2 className="text-sm font-semibold text-slate-300">
            アーカイブ済み（アクセス停止中） {archived.length}件
          </h2>
          <p className="text-[11px] text-slate-600">
            削除されたディーラーです。メンバーは停止されておりログインできません。
            復元すると承認状態とメンバーのアクセスが元に戻ります。データは削除されていません。
          </p>
          <div className="bg-[#0b1120] border border-slate-800 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-800">
                    {["店舗", "メール", "登録日", "操作"].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-[10px] font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/40">
                  {archived.map((dealer) => (
                    <tr key={dealer.id} className="hover:bg-slate-800/20 transition-colors opacity-80">
                      <td className="px-4 py-3 font-medium text-slate-300">{dealer.name ?? "（名称未設定）"}</td>
                      <td className="px-4 py-3 text-slate-500">{dealer.email ?? "—"}</td>
                      <td className="px-4 py-3 text-slate-500">{fmt(dealer.created_at)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleRestore(dealer)}
                            disabled={isPending}
                            className="text-[10px] px-2 py-1 bg-green-900/40 hover:bg-green-800/50 text-green-300 rounded transition-colors disabled:opacity-50"
                          >
                            復元
                          </button>
                          {/* 完全削除 — permanent, irreversible. Hidden when the owner
                              is a protected platform/admin user. */}
                          {!(dealer.owner_user_id && protectedOwnerIds.includes(dealer.owner_user_id)) && (
                            <button
                              onClick={() => setModal({ type: "purge", dealer })}
                              disabled={isPending}
                              className="text-[10px] px-2 py-1 bg-red-950/60 hover:bg-red-900/70 text-red-400 rounded transition-colors disabled:opacity-50"
                            >
                              完全削除
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

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
      {modal.type === "purge" && (
        <PurgeModal
          dealer={modal.dealer}
          onClose={() => setModal({ type: "none" })}
          onPurge={() => handlePurge(modal.dealer)}
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
