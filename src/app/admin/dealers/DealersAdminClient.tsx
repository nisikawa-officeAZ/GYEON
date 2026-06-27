"use client";

import { useState, useTransition } from "react";
import { updateDealerPlan, updateDealerSubscriptionStatus } from "@/lib/admin/update-dealer-plan";
import { approveDealerTrial, rejectDealer } from "@/lib/admin/approve-dealer";

type Plan = "basic" | "pro" | "pro_plus";
type SubStatus = "active" | "trial" | "expired" | "cancelled";

interface Dealer {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  plan: string;
  subscription_status: string;
  started_at: string | null;
  expired_at: string | null;
  created_at: string;
  owner_user_id: string | null;
  // PHASE71 approval
  approval_status:          string | null;
  approved_at:              string | null;
  rejection_reason:         string | null;
  // PHASE74 trial
  trial_plan_type:          string | null;
  service_start_date:       string | null;
  trial_start_date:         string | null;
  trial_end_date:           string | null;
  trial_status:             string | null;
  auto_downgrade_plan_type: string | null;
  detailer_rank:            string | null;
}

interface Props {
  dealers: Dealer[];
}

function planBadgeClass(plan: string): string {
  switch (plan) {
    case "pro_plus": return "bg-purple-900/50 text-purple-300 border border-purple-700/50";
    case "pro":      return "bg-blue-900/50 text-blue-300 border border-blue-700/50";
    default:         return "bg-slate-800 text-slate-400 border border-slate-700";
  }
}

function planLabel(plan: string): string {
  switch (plan) {
    case "pro_plus": return "Pro+";
    case "pro":      return "Pro";
    default:         return "Basic";
  }
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case "active":    return "bg-green-900/50 text-green-300 border border-green-700/50";
    case "trial":     return "bg-amber-900/50 text-amber-300 border border-amber-700/50";
    case "expired":   return "bg-red-900/50 text-red-300 border border-red-700/50";
    default:          return "bg-slate-800 text-slate-400 border border-slate-700";
  }
}

function approvalBadgeClass(status: string | null): string {
  switch (status) {
    case "approved": return "bg-green-900/50 text-green-300 border border-green-700/50";
    case "rejected": return "bg-red-900/50 text-red-300 border border-red-700/50";
    case "pending":  return "bg-amber-900/50 text-amber-300 border border-amber-700/50";
    default:         return "bg-slate-800 text-slate-400 border border-slate-700";
  }
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("ja-JP", {
    year: "numeric", month: "2-digit", day: "2-digit",
  });
}

function defaultTrialEndDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString().split("T")[0];
}

function trialDaysLabel(trialEnd: string | null): string {
  if (!trialEnd) return "—";
  const today = new Date(new Date().toISOString().split("T")[0]).getTime();
  const end   = new Date(trialEnd).getTime();
  const days  = Math.round((end - today) / 86_400_000);
  if (days < 0)  return "終了";
  if (days === 0) return "本日終了";
  return `残り${days}日`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Inline approval panel shown for each pending dealer
// ─────────────────────────────────────────────────────────────────────────────
function ApprovalPanel({
  dealer,
  onApprove,
  onReject,
  isPending,
}: {
  dealer: Dealer;
  onApprove: (dealerId: string, trialEndDate: string) => void;
  onReject:  (dealerId: string, reason: string) => void;
  isPending: boolean;
}) {
  const [expanded,     setExpanded]     = useState(false);
  const [trialEndDate, setTrialEndDate] = useState(defaultTrialEndDate);
  const [rejectReason, setRejectReason] = useState("");
  const [showReject,   setShowReject]   = useState(false);

  if (!expanded) {
    return (
      <tr className="border-b border-amber-900/30">
        <td colSpan={4} className="px-4 py-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <span className="font-medium text-slate-200">{dealer.name ?? "（名称未設定）"}</span>
              <span className="ml-2 text-xs text-slate-500">{dealer.email}</span>
            </div>
            <button
              onClick={() => setExpanded(true)}
              className="text-xs px-3 py-1.5 rounded bg-amber-600 hover:bg-amber-500 text-white font-medium transition-colors"
            >
              承認・拒否
            </button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-b border-amber-900/30">
      <td colSpan={4} className="px-4 py-4">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="font-semibold text-slate-100">{dealer.name ?? "（名称未設定）"}</span>
              <span className="ml-2 text-xs text-slate-400">{dealer.email}</span>
            </div>
            <button onClick={() => setExpanded(false)} className="text-slate-500 hover:text-slate-300 text-lg leading-none">
              ✕
            </button>
          </div>

          {/* Trial defaults — clearly shown */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <div className="bg-slate-800/60 rounded-lg p-3 border border-slate-700/50">
              <div className="text-slate-500 mb-1">開始プラン</div>
              <div className="font-semibold text-purple-300">Pro Plus</div>
            </div>
            <div className="bg-slate-800/60 rounded-lg p-3 border border-slate-700/50">
              <div className="text-slate-500 mb-1">試用開始日</div>
              <div className="font-medium text-slate-200">{formatDate(new Date().toISOString())}</div>
            </div>
            <div className="bg-slate-800/60 rounded-lg p-3 border border-amber-700/40">
              <div className="text-slate-500 mb-1.5">
                試用終了日 <span className="text-amber-400">（変更可）</span>
              </div>
              <input
                type="date"
                value={trialEndDate}
                onChange={(e) => setTrialEndDate(e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 text-slate-100 rounded px-2 py-0.5 text-xs focus:outline-none focus:border-amber-500"
              />
            </div>
            <div className="bg-slate-800/60 rounded-lg p-3 border border-slate-700/50">
              <div className="text-slate-500 mb-1">試用後プラン</div>
              <div className="font-medium text-slate-400">Basic（自動）</div>
            </div>
          </div>

          {/* Actions */}
          {!showReject ? (
            <div className="flex gap-2">
              <button
                disabled={isPending}
                onClick={() => onApprove(dealer.id, trialEndDate)}
                className="px-4 py-2 rounded-lg bg-green-700 hover:bg-green-600 disabled:opacity-50 text-white text-sm font-medium transition-colors"
              >
                承認（Pro Plus 30日試用）
              </button>
              <button
                disabled={isPending}
                onClick={() => setShowReject(true)}
                className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-slate-200 text-sm font-medium transition-colors"
              >
                拒否
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <input
                type="text"
                placeholder="拒否理由（任意）"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 text-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-500 placeholder-slate-500"
              />
              <div className="flex gap-2">
                <button
                  disabled={isPending}
                  onClick={() => onReject(dealer.id, rejectReason)}
                  className="px-4 py-2 rounded-lg bg-red-800 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-medium transition-colors"
                >
                  拒否を確定
                </button>
                <button
                  onClick={() => setShowReject(false)}
                  className="px-3 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm transition-colors"
                >
                  キャンセル
                </button>
              </div>
            </div>
          )}
        </div>
      </td>
    </tr>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main client component
// ─────────────────────────────────────────────────────────────────────────────
export default function DealersAdminClient({ dealers: initialDealers }: Props) {
  const [dealers, setDealers] = useState<Dealer[]>(initialDealers);
  const [search,  setSearch]  = useState("");
  const [toast,   setToast]   = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [isPending, startTransition] = useTransition();

  const showToast = (message: string, type: "success" | "error") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const pending  = dealers.filter((d) => d.approval_status === "pending" || d.approval_status === null);
  const approved = dealers.filter((d) => d.approval_status === "approved");
  const rejected = dealers.filter((d) => d.approval_status === "rejected");

  const filteredApproved = search.trim()
    ? approved.filter(
        (d) =>
          d.name?.toLowerCase().includes(search.toLowerCase()) ||
          d.email?.toLowerCase().includes(search.toLowerCase())
      )
    : approved;

  const handlePlanChange = (dealerId: string, newPlan: Plan) => {
    startTransition(async () => {
      const result = await updateDealerPlan(dealerId, newPlan);
      if (result.success) {
        setDealers((prev) => prev.map((d) => d.id === dealerId ? { ...d, plan: newPlan } : d));
        showToast("プランを更新しました", "success");
      } else {
        showToast(result.error ?? "エラーが発生しました", "error");
      }
    });
  };

  const handleStatusChange = (dealerId: string, newStatus: SubStatus) => {
    startTransition(async () => {
      const result = await updateDealerSubscriptionStatus(dealerId, newStatus);
      if (result.success) {
        setDealers((prev) =>
          prev.map((d) => d.id === dealerId ? { ...d, subscription_status: newStatus } : d)
        );
        showToast("ステータスを更新しました", "success");
      } else {
        showToast(result.error ?? "エラーが発生しました", "error");
      }
    });
  };

  const handleApprove = (dealerId: string, trialEndDate: string) => {
    startTransition(async () => {
      const result = await approveDealerTrial(dealerId, { trialEndDate });
      if (result.success) {
        setDealers((prev) =>
          prev.map((d) =>
            d.id === dealerId
              ? {
                  ...d,
                  approval_status:          "approved",
                  plan:                     "pro_plus",
                  subscription_status:      "trial",
                  trial_status:             "active",
                  trial_end_date:           trialEndDate,
                  trial_plan_type:          "pro_plus",
                  auto_downgrade_plan_type: "basic",
                }
              : d
          )
        );
        showToast("承認しました", "success");
      } else {
        showToast(result.error ?? "エラーが発生しました", "error");
      }
    });
  };

  const handleReject = (dealerId: string, reason: string) => {
    startTransition(async () => {
      const result = await rejectDealer(dealerId, reason);
      if (result.success) {
        setDealers((prev) =>
          prev.map((d) =>
            d.id === dealerId
              ? { ...d, approval_status: "rejected", rejection_reason: reason }
              : d
          )
        );
        showToast("拒否しました", "success");
      } else {
        showToast(result.error ?? "エラーが発生しました", "error");
      }
    });
  };

  return (
    <div className="space-y-8">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-16 right-4 z-50 px-4 py-2 rounded-lg text-sm font-medium shadow-lg transition-all ${
            toast.type === "success"
              ? "bg-green-900 text-green-200 border border-green-700"
              : "bg-red-900 text-red-200 border border-red-700"
          }`}
        >
          {toast.message}
        </div>
      )}

      {/* ── 承認待ちセクション ─────────────────────────────────────────────── */}
      {pending.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-sm font-semibold text-amber-300">承認待ち</h2>
            <span className="text-xs bg-amber-900/50 text-amber-300 border border-amber-700/50 px-1.5 py-0.5 rounded">
              {pending.length}件
            </span>
          </div>
          <div className="bg-[#0f172a] border border-amber-900/40 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <tbody className="bg-amber-950/10">
                {pending.map((dealer) => (
                  <ApprovalPanel
                    key={dealer.id}
                    dealer={dealer}
                    onApprove={handleApprove}
                    onReject={handleReject}
                    isPending={isPending}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── 承認済みディーラーテーブル ────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-100">Dealers</h1>
            <p className="text-sm text-slate-500 mt-0.5">{approved.length} 件（承認済み）</p>
          </div>
          <input
            type="text"
            placeholder="名前・メールで絞り込み..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-64 px-3 py-1.5 text-sm bg-[#1e293b] border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-slate-500"
          />
        </div>

        <div className="bg-[#0f172a] border border-slate-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">ディーラー名</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">メール</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">プラン</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">ステータス</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">試用残り</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">試用終了日</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">登録日</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {filteredApproved.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-slate-500 text-sm">
                      {search ? "該当するディーラーが見つかりません" : "承認済みのディーラーがありません"}
                    </td>
                  </tr>
                ) : (
                  filteredApproved.map((dealer) => (
                    <tr key={dealer.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-4 py-3">
                        <span className="font-medium text-slate-200">{dealer.name ?? "—"}</span>
                      </td>
                      <td className="px-4 py-3 text-slate-400">{dealer.email ?? "—"}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${planBadgeClass(dealer.plan)}`}>
                            {planLabel(dealer.plan)}
                          </span>
                          <select
                            value={dealer.plan}
                            onChange={(e) => handlePlanChange(dealer.id, e.target.value as Plan)}
                            disabled={isPending}
                            className="text-xs bg-slate-800 border border-slate-700 text-slate-300 rounded px-2 py-0.5 focus:outline-none focus:border-slate-500 disabled:opacity-50"
                          >
                            <option value="basic">Basic</option>
                            <option value="pro">Pro</option>
                            <option value="pro_plus">Pro+</option>
                          </select>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${statusBadgeClass(dealer.subscription_status)}`}>
                            {dealer.subscription_status}
                          </span>
                          <select
                            value={dealer.subscription_status}
                            onChange={(e) => handleStatusChange(dealer.id, e.target.value as SubStatus)}
                            disabled={isPending}
                            className="text-xs bg-slate-800 border border-slate-700 text-slate-300 rounded px-2 py-0.5 focus:outline-none focus:border-slate-500 disabled:opacity-50"
                          >
                            <option value="active">active</option>
                            <option value="trial">trial</option>
                            <option value="expired">expired</option>
                            <option value="cancelled">cancelled</option>
                          </select>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {dealer.trial_status === "active" ? (
                          <span className="text-xs font-medium text-amber-300">
                            {trialDaysLabel(dealer.trial_end_date)}
                          </span>
                        ) : dealer.trial_status === "ended" ? (
                          <span className="text-xs text-slate-500">終了</span>
                        ) : (
                          <span className="text-xs text-slate-600">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-400 text-xs">{formatDate(dealer.trial_end_date)}</td>
                      <td className="px-4 py-3 text-slate-400 text-xs">{formatDate(dealer.created_at)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── 拒否済みセクション ────────────────────────────────────────────── */}
      {rejected.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-slate-500 mb-3">拒否済み（{rejected.length}件）</h2>
          <div className="bg-[#0f172a] border border-slate-800 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">ディーラー名</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">メール</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">拒否理由</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">登録日</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {rejected.map((dealer) => (
                  <tr key={dealer.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-4 py-3 font-medium text-slate-400">{dealer.name ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-500">{dealer.email ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{dealer.rejection_reason ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{formatDate(dealer.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
