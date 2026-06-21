"use client";

import { useState, useTransition } from "react";
import { updateDealerPlan, updateDealerSubscriptionStatus } from "@/lib/admin/update-dealer-plan";

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

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

export default function DealersAdminClient({ dealers: initialDealers }: Props) {
  const [dealers, setDealers] = useState<Dealer[]>(initialDealers);
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [isPending, startTransition] = useTransition();

  const showToast = (message: string, type: "success" | "error") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const filtered = search.trim()
    ? dealers.filter(
        (d) =>
          d.name?.toLowerCase().includes(search.toLowerCase()) ||
          d.email?.toLowerCase().includes(search.toLowerCase())
      )
    : dealers;

  const handlePlanChange = (dealerId: string, newPlan: Plan) => {
    startTransition(async () => {
      const result = await updateDealerPlan(dealerId, newPlan);
      if (result.success) {
        setDealers((prev) =>
          prev.map((d) => (d.id === dealerId ? { ...d, plan: newPlan } : d))
        );
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
          prev.map((d) =>
            d.id === dealerId ? { ...d, subscription_status: newStatus } : d
          )
        );
        showToast("ステータスを更新しました", "success");
      } else {
        showToast(result.error ?? "エラーが発生しました", "error");
      }
    });
  };

  return (
    <div className="space-y-6">
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

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-100">Dealers</h1>
          <p className="text-sm text-slate-500 mt-0.5">{dealers.length} 件のディーラー</p>
        </div>
        <input
          type="text"
          placeholder="名前・メールで絞り込み..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-64 px-3 py-1.5 text-sm bg-[#1e293b] border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-slate-500"
        />
      </div>

      {/* Table */}
      <div className="bg-[#0f172a] border border-slate-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                  ディーラー名
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                  メール
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                  プラン
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                  ステータス
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                  有効期限
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                  登録日
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500 text-sm">
                    {search ? "該当するディーラーが見つかりません" : "ディーラーがありません"}
                  </td>
                </tr>
              ) : (
                filtered.map((dealer) => (
                  <tr key={dealer.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-4 py-3">
                      <span className="font-medium text-slate-200">
                        {dealer.name ?? "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-400">{dealer.email ?? "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${planBadgeClass(dealer.plan)}`}
                        >
                          {planLabel(dealer.plan)}
                        </span>
                        <select
                          value={dealer.plan}
                          onChange={(e) =>
                            handlePlanChange(dealer.id, e.target.value as Plan)
                          }
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
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${statusBadgeClass(dealer.subscription_status)}`}
                        >
                          {dealer.subscription_status}
                        </span>
                        <select
                          value={dealer.subscription_status}
                          onChange={(e) =>
                            handleStatusChange(dealer.id, e.target.value as SubStatus)
                          }
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
                    <td className="px-4 py-3 text-slate-400">{formatDate(dealer.expired_at)}</td>
                    <td className="px-4 py-3 text-slate-400">{formatDate(dealer.created_at)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
