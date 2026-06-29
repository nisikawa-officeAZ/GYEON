"use client";

import { useState, useEffect, useTransition } from "react";
import { getDealerDetail } from "@/lib/admin/get-dealer-detail";
import { extendDealerTrial, changeDealerRank, resetDealerAccount } from "@/lib/admin/dealer-lifecycle-actions";
import { updateDealerPlan } from "@/lib/admin/update-dealer-plan";
import { suspendDealer, reactivateDealer } from "@/lib/admin/approve-dealer";
import type { DealerAdminView } from "@/lib/admin/admin-types";
import type { DealerDetail, TimelineEvent, AdminAuditEntry } from "@/lib/admin/get-dealer-detail";
import { DEALER_RANKS, normalizeRank, rankLabelOrDash } from "@/lib/ranks/dealer-ranks";

type Tab = "overview" | "timeline" | "audit" | "actions";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(d: string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("ja-JP", { year: "numeric", month: "2-digit", day: "2-digit" });
}

function fmtDateTime(d: string | null | undefined): string {
  if (!d) return "—";
  const dt = new Date(d);
  return dt.toLocaleDateString("ja-JP", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
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
    default:         return "text-slate-400  bg-slate-800/50  border-slate-700/40";
  }
}

function rankLabel(r: string | null): string {
  return rankLabelOrDash(r);
}

function approvalLabel(s: string | null): string {
  switch (s) {
    case "approved":  return "承認済み";
    case "rejected":  return "拒否";
    case "suspended": return "停止";
    case "pending":
    default:          return "承認待ち";
  }
}

function approvalClass(s: string | null): string {
  switch (s) {
    case "approved":  return "text-green-300 bg-green-900/30 border-green-700/40";
    case "rejected":  return "text-red-300   bg-red-900/30   border-red-700/40";
    case "suspended": return "text-orange-300 bg-orange-900/30 border-orange-700/40";
    default:          return "text-amber-300 bg-amber-900/30 border-amber-700/40";
  }
}

function timelineTypeColor(type: TimelineEvent["type"]): string {
  switch (type) {
    case "registration":  return "bg-blue-500";
    case "approval":      return "bg-green-500";
    case "service_start": return "bg-teal-500";
    case "trial_start":   return "bg-amber-500";
    case "trial_end":     return "bg-orange-500";
    case "trial_extended":return "bg-yellow-500";
    case "plan_change":   return "bg-purple-500";
    case "rank_change":   return "bg-sky-500";
    case "suspension":    return "bg-orange-600";
    case "reactivation":  return "bg-green-400";
    case "rejection":     return "bg-red-500";
    case "auto_downgrade":return "bg-slate-500";
    case "reset":         return "bg-red-600";
    default:              return "bg-slate-600";
  }
}

// ── Sub-sections ──────────────────────────────────────────────────────────────

function OverviewTab({
  dealer,
  detail,
}: {
  dealer: DealerAdminView;
  detail: DealerDetail;
}) {
  const { stats } = detail;
  const daysRemaining = stats.daysRemaining;

  const trialCountdown = () => {
    if (dealer.trial_status !== "active") return null;
    if (daysRemaining === null) return <span className="text-amber-300">試用中</span>;
    if (daysRemaining === 0)   return <span className="text-red-400 font-semibold">本日終了</span>;
    if (daysRemaining < 0)     return <span className="text-slate-500">終了済み</span>;
    if (daysRemaining <= 7)    return <span className="text-red-400">残り{daysRemaining}日</span>;
    return <span className="text-amber-300">残り{daysRemaining}日</span>;
  };

  return (
    <div className="space-y-6">
      {/* Current status */}
      <div>
        <h3 className="text-[10px] font-bold text-slate-600 uppercase tracking-widest mb-3">Current Status</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
            <div className="text-[10px] text-slate-500 mb-1">Approval</div>
            <span className={`inline-flex text-[10px] font-semibold px-2 py-0.5 rounded border ${approvalClass(dealer.approval_status)}`}>
              {approvalLabel(dealer.approval_status)}
            </span>
          </div>
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
            <div className="text-[10px] text-slate-500 mb-1">Plan</div>
            <span className={`inline-flex text-[10px] font-semibold px-2 py-0.5 rounded border ${planClass(dealer.plan)}`}>
              {planLabel(dealer.plan)}
            </span>
          </div>
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
            <div className="text-[10px] text-slate-500 mb-1">Detailer Rank</div>
            <div className="text-xs text-slate-300 font-medium">{rankLabel(dealer.detailer_rank)}</div>
          </div>
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
            <div className="text-[10px] text-slate-500 mb-1">Trial</div>
            <div className="text-xs">{trialCountdown() ?? <span className="text-slate-600">—</span>}</div>
          </div>
        </div>
      </div>

      {/* Operational summary */}
      <div>
        <h3 className="text-[10px] font-bold text-slate-600 uppercase tracking-widest mb-3">Operational Summary</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Estimates",  value: stats.estimateCount },
            { label: "Customers",  value: stats.customerCount },
            { label: "Vehicles",   value: stats.vehicleCount  },
            { label: "OCR Usage",  value: stats.ocrCount      },
          ].map(({ label, value }) => (
            <div key={label} className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-slate-100">{value.toLocaleString()}</div>
              <div className="text-[10px] text-slate-500 mt-1">{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Store & contact */}
      <div>
        <h3 className="text-[10px] font-bold text-slate-600 uppercase tracking-widest mb-3">Store & Contact</h3>
        <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-xs">
          <div><div className="text-slate-500 mb-0.5">Email</div><div className="text-slate-300">{dealer.email ?? "—"}</div></div>
          <div><div className="text-slate-500 mb-0.5">Phone</div><div className="text-slate-300">{dealer.phone ?? "—"}</div></div>
          <div><div className="text-slate-500 mb-0.5">Last Login</div>
            <div className="text-slate-300">{stats.lastLogin ? fmtDateTime(stats.lastLogin) : "—"}</div>
          </div>
          <div><div className="text-slate-500 mb-0.5">Registered</div><div className="text-slate-300">{fmt(dealer.created_at)}</div></div>
          <div><div className="text-slate-500 mb-0.5">Service Start</div><div className="text-slate-300">{fmt(dealer.service_start_date)}</div></div>
          <div><div className="text-slate-500 mb-0.5">Trial End</div>
            <div className="text-slate-300">{fmt(dealer.trial_end_date)}</div>
          </div>
          <div><div className="text-slate-500 mb-0.5">Auto-downgrade</div>
            <span className={`inline-flex text-[10px] px-2 py-0.5 rounded border ${planClass(dealer.auto_downgrade_plan_type)}`}>
              {planLabel(dealer.auto_downgrade_plan_type)}
            </span>
          </div>
          <div><div className="text-slate-500 mb-0.5">Subscription</div><div className="text-slate-400">{dealer.subscription_status}</div></div>
        </div>
      </div>

      {/* Internal notes */}
      {dealer.admin_notes && (
        <div>
          <h3 className="text-[10px] font-bold text-slate-600 uppercase tracking-widest mb-3">Internal Notes</h3>
          <div className="text-xs text-slate-300 bg-slate-800/40 border border-slate-700/50 rounded-lg px-4 py-3 whitespace-pre-wrap">
            {dealer.admin_notes}
          </div>
        </div>
      )}
    </div>
  );
}

function TimelineTab({ events }: { events: TimelineEvent[] }) {
  if (events.length === 0) {
    return <div className="text-sm text-slate-600 py-8 text-center">タイムラインイベントがありません</div>;
  }
  return (
    <div className="relative pl-6">
      <div className="absolute left-[7px] top-0 bottom-0 w-px bg-slate-800" />
      <div className="space-y-5">
        {[...events].reverse().map((ev) => (
          <div key={ev.id} className="relative">
            <div className={`absolute -left-[25px] w-3 h-3 rounded-full ${timelineTypeColor(ev.type)} ring-2 ring-slate-900`} />
            <div className="text-[10px] text-slate-600 mb-0.5">{fmtDateTime(ev.date)}</div>
            <div className="text-xs font-medium text-slate-200">{ev.label}</div>
            {ev.detail && <div className="text-[10px] text-slate-500 mt-0.5">{ev.detail}</div>}
            {ev.actor  && <div className="text-[10px] text-slate-700 mt-0.5">by {ev.actor}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

function AuditTab({ logs }: { logs: AdminAuditEntry[] }) {
  if (logs.length === 0) {
    return <div className="text-sm text-slate-600 py-8 text-center">管理者アクションの記録がありません</div>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-slate-800">
            {["日時", "オペレーター", "アクション", "変更前", "変更後"].map((h) => (
              <th key={h} className="text-left px-3 py-2 text-[10px] font-semibold text-slate-600 uppercase tracking-wider">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/40">
          {logs.map((log) => {
            const from = log.details.from ?? log.details.previous_approval_status ?? log.details.previous_plan;
            const to   = log.details.to   ?? log.details.plan ?? log.details.subscription_status;
            return (
              <tr key={log.id} className="hover:bg-slate-800/20 transition-colors">
                <td className="px-3 py-2 text-slate-500 whitespace-nowrap">{fmtDateTime(log.created_at)}</td>
                <td className="px-3 py-2">
                  <div className="text-slate-300">{log.admin_name ?? log.admin_email ?? "—"}</div>
                  {log.admin_name && log.admin_email && (
                    <div className="text-[10px] text-slate-600">{log.admin_email}</div>
                  )}
                </td>
                <td className="px-3 py-2">
                  <span className="text-slate-300 font-medium">{log.action}</span>
                </td>
                <td className="px-3 py-2 text-slate-500 font-mono">
                  {from !== undefined ? String(from) : "—"}
                </td>
                <td className="px-3 py-2 text-slate-300 font-mono">
                  {to !== undefined ? String(to) : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ActionsTab({
  dealer,
  onAction,
  showToast,
}: {
  dealer: DealerAdminView;
  onAction: (update: Partial<DealerAdminView>) => void;
  showToast: (msg: string, type: "success" | "error") => void;
}) {
  const [isPending, startTransition] = useTransition();

  // Extend trial state
  const [newTrialEnd, setNewTrialEnd] = useState(dealer.trial_end_date ?? "");

  // Change plan state
  const [newPlan, setNewPlan] = useState(dealer.plan ?? "pro_plus");

  // Change rank state
  const [newRank, setNewRank] = useState<string>(normalizeRank(dealer.detailer_rank));

  // Suspend state
  const [suspendReason, setSuspendReason] = useState("");

  // Reset state
  const [resetInput, setResetInput] = useState("");

  const isSuspended = dealer.approval_status === "suspended";
  const isPendingOrRejected = !dealer.approval_status || dealer.approval_status === "pending" || dealer.approval_status === "rejected";

  return (
    <div className="space-y-6">

      {/* Extend Trial */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5">
        <h4 className="text-xs font-semibold text-slate-300 mb-1">Extend Trial</h4>
        <p className="text-[10px] text-slate-500 mb-3">
          Current end: {dealer.trial_end_date ? fmt(dealer.trial_end_date) : "—"}&nbsp;·&nbsp;
          Status: {dealer.trial_status ?? "—"}
        </p>
        <div className="flex items-center gap-3">
          <input
            type="date"
            value={newTrialEnd}
            onChange={(e) => setNewTrialEnd(e.target.value)}
            className="px-3 py-1.5 text-sm bg-slate-800 border border-slate-600 rounded-lg text-slate-200 focus:outline-none focus:border-amber-500"
          />
          <button
            onClick={() => {
              if (!newTrialEnd) return;
              startTransition(async () => {
                const r = await extendDealerTrial(dealer.id, newTrialEnd);
                if (r.success) {
                  onAction({ trial_end_date: newTrialEnd, trial_status: "active" });
                  showToast("試用期間を延長しました", "success");
                } else {
                  showToast(r.error ?? "エラーが発生しました", "error");
                }
              });
            }}
            disabled={isPending || !newTrialEnd}
            className="px-4 py-1.5 bg-amber-700 hover:bg-amber-600 text-white text-xs rounded-lg transition-colors disabled:opacity-40"
          >
            延長する
          </button>
        </div>
      </div>

      {/* Change Plan */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5">
        <h4 className="text-xs font-semibold text-slate-300 mb-1">Change Plan</h4>
        <p className="text-[10px] text-slate-500 mb-3">Current: {planLabel(dealer.plan)}</p>
        <div className="flex items-center gap-2">
          <select
            value={newPlan}
            onChange={(e) => setNewPlan(e.target.value)}
            className="px-3 py-1.5 text-sm bg-slate-800 border border-slate-600 rounded-lg text-slate-200 focus:outline-none focus:border-slate-400"
          >
            <option value="pro_plus">Pro Plus</option>
            <option value="pro">Pro</option>
            <option value="basic">Basic</option>
          </select>
          <button
            onClick={() => {
              startTransition(async () => {
                const r = await updateDealerPlan(dealer.id, newPlan as "basic" | "pro" | "pro_plus");
                if (r.success) {
                  onAction({ plan: newPlan });
                  showToast(`プランを ${planLabel(newPlan)} に変更しました`, "success");
                } else {
                  showToast(r.error ?? "エラーが発生しました", "error");
                }
              });
            }}
            disabled={isPending || newPlan === dealer.plan}
            className="px-4 py-1.5 bg-purple-700 hover:bg-purple-600 text-white text-xs rounded-lg transition-colors disabled:opacity-40"
          >
            変更する
          </button>
        </div>
      </div>

      {/* Change Rank */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5">
        <h4 className="text-xs font-semibold text-slate-300 mb-1">Change Detailer Rank</h4>
        <p className="text-[10px] text-slate-500 mb-3">Current: {rankLabel(dealer.detailer_rank)}</p>
        <div className="flex items-center gap-2">
          <select
            value={newRank}
            onChange={(e) => setNewRank(e.target.value)}
            className="px-3 py-1.5 text-sm bg-slate-800 border border-slate-600 rounded-lg text-slate-200 focus:outline-none focus:border-slate-400"
          >
            {DEALER_RANKS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.labelEn}</option>
            ))}
          </select>
          <button
            onClick={() => {
              startTransition(async () => {
                const r = await changeDealerRank(dealer.id, newRank);
                if (r.success) {
                  onAction({ detailer_rank: newRank });
                  showToast(`ランクを ${rankLabel(newRank)} に変更しました`, "success");
                } else {
                  showToast(r.error ?? "エラーが発生しました", "error");
                }
              });
            }}
            disabled={isPending || newRank === (dealer.detailer_rank ?? "")}
            className="px-4 py-1.5 bg-sky-700 hover:bg-sky-600 text-white text-xs rounded-lg transition-colors disabled:opacity-40"
          >
            変更する
          </button>
        </div>
      </div>

      {/* Suspend / Re-activate */}
      {!isPendingOrRejected && (
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5">
          <h4 className="text-xs font-semibold text-slate-300 mb-1">
            {isSuspended ? "Re-activate Dealer" : "Suspend Dealer"}
          </h4>
          {isSuspended ? (
            <div>
              <p className="text-[10px] text-slate-500 mb-3">アカウントを再有効化します。試用状況は自動判定されます。</p>
              <button
                onClick={() => {
                  startTransition(async () => {
                    const r = await reactivateDealer(dealer.id);
                    if (r.success) {
                      onAction({ approval_status: "approved" });
                      showToast("再有効化しました", "success");
                    } else {
                      showToast(r.error ?? "エラーが発生しました", "error");
                    }
                  });
                }}
                disabled={isPending}
                className="px-4 py-1.5 bg-green-700 hover:bg-green-600 text-white text-xs rounded-lg transition-colors disabled:opacity-40"
              >
                再有効化する
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-[10px] text-slate-500">アカウントを停止します。再有効化はいつでも可能です。</p>
              <textarea
                rows={2}
                value={suspendReason}
                onChange={(e) => setSuspendReason(e.target.value)}
                placeholder="停止理由（任意）"
                className="w-full px-3 py-2 text-sm bg-slate-800 border border-slate-600 rounded-lg text-slate-200 placeholder-slate-600 focus:outline-none focus:border-orange-600 resize-none"
              />
              <button
                onClick={() => {
                  startTransition(async () => {
                    const r = await suspendDealer(dealer.id, suspendReason);
                    if (r.success) {
                      onAction({ approval_status: "suspended", subscription_status: "suspended" });
                      showToast("アカウントを停止しました", "success");
                      setSuspendReason("");
                    } else {
                      showToast(r.error ?? "エラーが発生しました", "error");
                    }
                  });
                }}
                disabled={isPending}
                className="px-4 py-1.5 bg-orange-700 hover:bg-orange-600 text-white text-xs rounded-lg transition-colors disabled:opacity-40"
              >
                停止する
              </button>
            </div>
          )}
        </div>
      )}

      {/* Reset Account */}
      <div className="bg-red-950/20 border border-red-900/40 rounded-xl p-5">
        <h4 className="text-xs font-semibold text-red-400 mb-1">Reset Dealer Account</h4>
        <p className="text-[10px] text-red-500/70 mb-1">
          承認・試用状態をリセットして「承認待ち」に戻します。
          店舗データ（見積・顧客・車両）は保持されます。
        </p>
        <p className="text-[10px] text-slate-600 mb-3">
          確認のため <span className="font-mono font-bold text-slate-500">RESET</span> と入力してください
        </p>
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={resetInput}
            onChange={(e) => setResetInput(e.target.value)}
            placeholder="RESET"
            className="px-3 py-1.5 text-sm bg-slate-900 border border-red-900/60 rounded-lg text-slate-200 placeholder-slate-700 focus:outline-none focus:border-red-700 font-mono w-32"
          />
          <button
            onClick={() => {
              startTransition(async () => {
                const r = await resetDealerAccount(dealer.id);
                if (r.success) {
                  onAction({ approval_status: "pending", subscription_status: "cancelled", trial_status: "none" });
                  showToast("アカウントをリセットしました", "success");
                  setResetInput("");
                } else {
                  showToast(r.error ?? "エラーが発生しました", "error");
                }
              });
            }}
            disabled={isPending || resetInput !== "RESET"}
            className="px-4 py-1.5 bg-red-800 hover:bg-red-700 text-white text-xs rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            リセットする
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Panel ────────────────────────────────────────────────────────────────

interface Props {
  dealer: DealerAdminView;
  callerRole: string;
  onClose: () => void;
  onDealerUpdate: (dealerId: string, update: Partial<DealerAdminView>) => void;
}

export default function DealerDetailPanel({ dealer, callerRole, onClose, onDealerUpdate }: Props) {
  const [activeTab, setActiveTab]       = useState<Tab>("overview");
  const [detail,    setDetail]          = useState<DealerDetail | null>(null);
  const [loading,   setLoading]         = useState(true);
  const [toast,     setToast]           = useState<{ message: string; type: "success" | "error" } | null>(null);
  // Local copy of dealer so actions update live in the panel
  const [localDealer, setLocalDealer]   = useState<DealerAdminView>(dealer);

  const isReadOnly = callerRole === "logistics_admin";

  const showToast = (message: string, type: "success" | "error") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    setLoading(true);
    getDealerDetail(dealer.id, dealer).then((d) => {
      setDetail(d);
      setLoading(false);
    });
  }, [dealer.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAction = (update: Partial<DealerAdminView>) => {
    setLocalDealer((prev) => ({ ...prev, ...update }));
    onDealerUpdate(dealer.id, update);
  };

  const tabs: { key: Tab; label: string; hidden?: boolean }[] = [
    { key: "overview",  label: "Overview"  },
    { key: "timeline",  label: "Timeline"  },
    { key: "audit",     label: "Audit Log" },
    { key: "actions",   label: "Actions",  hidden: isReadOnly },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-[#0d1525] border border-slate-700 rounded-2xl w-full max-w-3xl mx-4 shadow-2xl flex flex-col max-h-[94vh]">

        {/* Toast */}
        {toast && (
          <div className={`absolute top-4 right-4 z-10 px-4 py-2 rounded-lg text-sm font-medium shadow-lg max-w-sm ${
            toast.type === "success"
              ? "bg-green-900 text-green-200 border border-green-700"
              : "bg-red-900 text-red-200 border border-red-700"
          }`}>
            {toast.message}
          </div>
        )}

        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-slate-100">{localDealer.name ?? "（名称未設定）"}</h2>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${
                  localDealer.approval_status === "approved"  ? "text-green-300 bg-green-900/30 border-green-700/40" :
                  localDealer.approval_status === "suspended" ? "text-orange-300 bg-orange-900/30 border-orange-700/40" :
                  localDealer.approval_status === "rejected"  ? "text-red-300 bg-red-900/30 border-red-700/40" :
                  "text-amber-300 bg-amber-900/30 border-amber-700/40"
                }`}>
                  {approvalLabel(localDealer.approval_status)}
                </span>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${planClass(localDealer.plan)}`}>
                  {planLabel(localDealer.plan)}
                </span>
                {localDealer.detailer_rank && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded border text-amber-300 bg-amber-900/20 border-amber-700/40">
                    {rankLabel(localDealer.detailer_rank)}
                  </span>
                )}
                {isReadOnly && (
                  <span className="text-[10px] px-2 py-0.5 rounded border text-slate-500 border-slate-700">
                    Read-only
                  </span>
                )}
              </div>
            </div>
            <button onClick={onClose} className="text-slate-500 hover:text-slate-300 text-xl leading-none shrink-0">✕</button>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mt-4">
            {tabs.filter((t) => !t.hidden).map((t) => (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${
                  activeTab === t.key
                    ? "bg-slate-700 text-slate-100"
                    : "text-slate-500 hover:text-slate-300 hover:bg-slate-800/50"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 py-5">
          {loading ? (
            <div className="flex items-center justify-center h-40 text-slate-500 text-sm">
              読み込み中...
            </div>
          ) : detail ? (
            <>
              {activeTab === "overview" && (
                <OverviewTab dealer={localDealer} detail={detail} />
              )}
              {activeTab === "timeline" && (
                <TimelineTab events={detail.timeline} />
              )}
              {activeTab === "audit" && (
                <AuditTab logs={detail.auditLogs} />
              )}
              {activeTab === "actions" && !isReadOnly && (
                <ActionsTab
                  dealer={localDealer}
                  onAction={handleAction}
                  showToast={showToast}
                />
              )}
            </>
          ) : (
            <div className="text-slate-500 text-sm text-center py-12">詳細データを取得できませんでした</div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 shrink-0 flex items-center justify-between">
          <div className="text-[10px] text-slate-700 font-mono">{dealer.id}</div>
          <button onClick={onClose} className="px-4 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs rounded-lg transition-colors">
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}
