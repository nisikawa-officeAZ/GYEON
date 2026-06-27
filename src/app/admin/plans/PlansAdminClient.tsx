"use client";

import { useState } from "react";
import type { DealerAdminView } from "@/lib/admin/admin-types";

interface Props {
  dealers: DealerAdminView[];
}

type PlanFilter    = "all" | "basic" | "pro" | "pro_plus";
type TrialFilter   = "all" | "active" | "ended" | "none";

function planLabel(plan: string | null): string {
  switch (plan) {
    case "pro_plus": return "Pro Plus";
    case "pro":      return "Pro";
    case "basic":    return "Basic";
    default:         return plan ?? "—";
  }
}

function planClass(plan: string | null): string {
  switch (plan) {
    case "pro_plus": return "text-purple-300 bg-purple-900/30 border border-purple-700/40";
    case "pro":      return "text-blue-300   bg-blue-900/30   border border-blue-700/40";
    default:         return "text-slate-400  bg-slate-800/60  border border-slate-700/40";
  }
}

function trialBadge(status: string | null, daysRemaining: number | null) {
  if (!status || status === "none") return null;
  if (status === "ended")
    return <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-500 border border-slate-700">終了</span>;
  if (status === "active") {
    if (daysRemaining === null)
      return <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-900/30 text-blue-300 border border-blue-700/40">試用中</span>;
    if (daysRemaining === 0)
      return <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-900/30 text-red-300 border border-red-700/40">本日終了</span>;
    if (daysRemaining <= 7)
      return <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-900/20 text-red-400 border border-red-800/40">残り{daysRemaining}日</span>;
    return <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-900/30 text-amber-300 border border-amber-700/40">残り{daysRemaining}日</span>;
  }
  return null;
}

function calcDaysRemaining(trialEnd: string | null): number | null {
  if (!trialEnd) return null;
  const today = new Date(new Date().toISOString().split("T")[0]).getTime();
  const end   = new Date(trialEnd).getTime();
  return Math.round((end - today) / 86_400_000);
}

function formatDate(d: string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("ja-JP", { year: "numeric", month: "2-digit", day: "2-digit" });
}

export default function PlansAdminClient({ dealers }: Props) {
  const [search,      setSearch]      = useState("");
  const [planFilter,  setPlanFilter]  = useState<PlanFilter>("all");
  const [trialFilter, setTrialFilter] = useState<TrialFilter>("all");

  const filtered = dealers.filter((d) => {
    const q = search.toLowerCase();
    const matchesSearch  = !q || d.name?.toLowerCase().includes(q) || d.email?.toLowerCase().includes(q);
    const matchesPlan    = planFilter  === "all" || d.plan === planFilter;
    const trialStatus    = d.trial_status ?? "none";
    const matchesTrial   = trialFilter === "all" || trialStatus === trialFilter;
    return matchesSearch && matchesPlan && matchesTrial;
  });

  return (
    <div className="space-y-5">

      {/* ── Filters ──────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder="名前・メールで検索..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-56 px-3 py-1.5 text-xs bg-[#0f172a] border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-slate-500"
        />

        {/* Plan filter chips */}
        <div className="flex gap-1">
          {(["all", "basic", "pro", "pro_plus"] as PlanFilter[]).map((p) => (
            <button
              key={p}
              onClick={() => setPlanFilter(p)}
              className={`text-[10px] px-2.5 py-1 rounded-full border transition-colors ${
                planFilter === p
                  ? "bg-blue-600/30 text-blue-300 border-blue-700/50"
                  : "text-slate-500 border-slate-700/50 hover:border-slate-600"
              }`}
            >
              {p === "all" ? "All plans" : planLabel(p)}
            </button>
          ))}
        </div>

        {/* Trial filter chips */}
        <div className="flex gap-1">
          {(["all", "active", "ended", "none"] as TrialFilter[]).map((t) => (
            <button
              key={t}
              onClick={() => setTrialFilter(t)}
              className={`text-[10px] px-2.5 py-1 rounded-full border transition-colors ${
                trialFilter === t
                  ? "bg-amber-600/20 text-amber-300 border-amber-700/40"
                  : "text-slate-500 border-slate-700/50 hover:border-slate-600"
              }`}
            >
              {t === "all" ? "All trials" : t === "none" ? "No trial" : t === "active" ? "Trial active" : "Trial ended"}
            </button>
          ))}
        </div>

        <span className="text-xs text-slate-600 ml-auto">{filtered.length} 件</span>
      </div>

      {/* ── Table ────────────────────────────────────────────────────────── */}
      <div className="bg-[#0b1120] border border-slate-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-800">
                {[
                  "ディーラー",
                  "現在のプラン",
                  "試用状況",
                  "試用終了日",
                  "サービス開始日",
                  "自動ダウングレード",
                  "ランク",
                ].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-[10px] font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/40">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-slate-600 text-xs">
                    該当するディーラーが見つかりません
                  </td>
                </tr>
              ) : (
                filtered.map((dealer) => {
                  const days = calcDaysRemaining(dealer.trial_end_date ?? null);
                  return (
                    <tr key={dealer.id} className="hover:bg-slate-800/20 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-200">{dealer.name ?? "—"}</div>
                        <div className="text-slate-500 text-[10px]">{dealer.email ?? "—"}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium ${planClass(dealer.plan)}`}>
                          {planLabel(dealer.plan)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {trialBadge(dealer.trial_status ?? null, days)}
                        {(!dealer.trial_status || dealer.trial_status === "none") && (
                          <span className="text-slate-700">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-400">{formatDate(dealer.trial_end_date)}</td>
                      <td className="px-4 py-3 text-slate-400">{formatDate(dealer.service_start_date)}</td>
                      <td className="px-4 py-3">
                        {dealer.auto_downgrade_plan_type ? (
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium ${planClass(dealer.auto_downgrade_plan_type)}`}>
                            {planLabel(dealer.auto_downgrade_plan_type)}
                          </span>
                        ) : (
                          <span className="text-slate-700">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        {dealer.detailer_rank ?? "—"}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
