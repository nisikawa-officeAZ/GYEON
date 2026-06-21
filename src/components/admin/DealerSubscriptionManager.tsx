"use client";

// PHASE58: Admin subscription management UI
// Lists all dealers with their subscription status.
// Allows admin to create/update subscriptions, extend trials, add notes.

import { useState, useTransition } from "react";
import {
  upsertDealerSubscription,
  extendDealerTrial,
  updateSubscriptionNote,
} from "@/lib/admin/subscription-actions";
import {
  getPlanLabel,
  getStatusLabel,
  getStatusBadgeColor,
  PlanCode,
  SubscriptionStatus,
  DealerSubscriptionWithPlan,
} from "@/lib/subscription/subscription-types";
import { planBadgeColor, planLabel } from "@/lib/plans/plan-types";

// ─── Types ────────────────────────────────────────────────────────────────────

interface DealerRow {
  id:                 string;
  name:               string | null;
  email:              string | null;
  plan:               string;
  subscription_status: string;
  started_at:         string | null;
  expired_at:         string | null;
  created_at:         string;
  subscription:       DealerSubscriptionWithPlan | null;
}

interface Props {
  dealers: DealerRow[];
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function DealerSubscriptionManager({ dealers }: Props) {
  const [selected, setSelected]   = useState<DealerRow | null>(null);
  const [mode, setMode]           = useState<"edit" | "trial" | "note" | null>(null);
  const [toast, setToast]         = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Edit form state
  const [editPlan,   setEditPlan]   = useState<PlanCode>("basic");
  const [editStatus, setEditStatus] = useState<SubscriptionStatus>("active");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd,   setPeriodEnd]   = useState("");
  const [trialEnd,    setTrialEnd]    = useState("");
  const [noteText,    setNoteText]    = useState("");

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  function openEdit(dealer: DealerRow) {
    setSelected(dealer);
    const sub = dealer.subscription;
    setEditPlan((sub?.plan_code ?? dealer.plan) as PlanCode);
    setEditStatus((sub?.status ?? "active") as SubscriptionStatus);
    setPeriodStart(sub?.current_period_started_at?.slice(0, 10) ?? dealer.started_at?.slice(0, 10) ?? "");
    setPeriodEnd(sub?.current_period_ends_at?.slice(0, 10) ?? dealer.expired_at?.slice(0, 10) ?? "");
    setTrialEnd(sub?.trial_ends_at?.slice(0, 10) ?? "");
    setNoteText(sub?.notes ?? "");
    setMode("edit");
  }

  function openTrial(dealer: DealerRow) {
    setSelected(dealer);
    setTrialEnd(dealer.subscription?.trial_ends_at?.slice(0, 10) ?? "");
    setMode("trial");
  }

  function openNote(dealer: DealerRow) {
    setSelected(dealer);
    setNoteText(dealer.subscription?.notes ?? "");
    setMode("note");
  }

  function close() {
    setSelected(null);
    setMode(null);
  }

  function handleSave() {
    if (!selected) return;
    startTransition(async () => {
      const res = await upsertDealerSubscription(selected.id, {
        plan_code:                 editPlan,
        status:                    editStatus,
        current_period_started_at: periodStart ? periodStart + "T00:00:00Z" : null,
        current_period_ends_at:    periodEnd   ? periodEnd   + "T23:59:59Z" : null,
        trial_ends_at:             trialEnd    ? trialEnd    + "T23:59:59Z" : null,
        notes:                     noteText    || null,
      });
      if (res.success) {
        showToast("サブスクリプションを更新しました");
        close();
      } else {
        showToast(`エラー: ${res.error}`);
      }
    });
  }

  function handleExtendTrial() {
    if (!selected || !trialEnd) return;
    startTransition(async () => {
      const res = await extendDealerTrial(selected.id, trialEnd + "T23:59:59Z");
      if (res.success) {
        showToast("トライアルを延長しました");
        close();
      } else {
        showToast(`エラー: ${res.error}`);
      }
    });
  }

  function handleSaveNote() {
    if (!selected) return;
    startTransition(async () => {
      const res = await updateSubscriptionNote(selected.id, noteText);
      if (res.success) {
        showToast("メモを保存しました");
        close();
      } else {
        showToast(`エラー: ${res.error}`);
      }
    });
  }

  const planOptions: PlanCode[]           = ["basic", "pro", "pro_plus"];
  const statusOptions: SubscriptionStatus[] = ["trial", "active", "past_due", "suspended", "cancelled"];

  return (
    <div className="flex flex-col gap-4">
      {/* Toast */}
      {toast && (
        <div className="fixed top-16 right-4 z-50 bg-slate-800 border border-slate-600 text-slate-100 text-xs px-4 py-2.5 rounded-lg shadow-lg">
          {toast}
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-800">
        <table className="w-full text-xs text-slate-300">
          <thead>
            <tr className="border-b border-slate-800 text-slate-500 text-[10px] uppercase tracking-wider">
              <th className="px-4 py-3 text-left">ディーラー</th>
              <th className="px-4 py-3 text-left">プラン</th>
              <th className="px-4 py-3 text-left">ステータス</th>
              <th className="px-4 py-3 text-left">トライアル終了</th>
              <th className="px-4 py-3 text-left">有効期限</th>
              <th className="px-4 py-3 text-left">メモ</th>
              <th className="px-4 py-3 text-left">操作</th>
            </tr>
          </thead>
          <tbody>
            {dealers.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                  ディーラーが登録されていません
                </td>
              </tr>
            )}
            {dealers.map((d) => {
              const sub       = d.subscription;
              const planCode  = (sub?.plan_code ?? d.plan) as PlanCode;
              const status    = (sub?.status ?? "active") as SubscriptionStatus;
              const trialEnds = sub?.trial_ends_at?.slice(0, 10) ?? "—";
              const periodEnds = sub?.current_period_ends_at?.slice(0, 10) ?? d.expired_at?.slice(0, 10) ?? "—";

              return (
                <tr key={d.id} className="border-b border-slate-800/50 hover:bg-slate-800/20 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-200">{d.name ?? "—"}</div>
                    <div className="text-[10px] text-slate-500">{d.email ?? "—"}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded border text-[10px] font-semibold ${planBadgeColor(planCode)}`}>
                      {getPlanLabel(planCode)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded border text-[10px] font-semibold ${getStatusBadgeColor(status)}`}>
                      {getStatusLabel(status)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-400">{trialEnds}</td>
                  <td className="px-4 py-3 text-slate-400">{periodEnds}</td>
                  <td className="px-4 py-3 text-slate-500 max-w-[120px] truncate">
                    {sub?.notes ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEdit(d)}
                        className="text-[10px] px-2 py-1 rounded bg-blue-900/40 text-blue-300 border border-blue-800/50 hover:bg-blue-900/60 transition-colors"
                      >
                        編集
                      </button>
                      <button
                        onClick={() => openTrial(d)}
                        className="text-[10px] px-2 py-1 rounded bg-amber-900/40 text-amber-300 border border-amber-800/50 hover:bg-amber-900/60 transition-colors"
                      >
                        延長
                      </button>
                      <button
                        onClick={() => openNote(d)}
                        className="text-[10px] px-2 py-1 rounded bg-slate-700 text-slate-300 border border-slate-600 hover:bg-slate-600 transition-colors"
                      >
                        メモ
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Modal overlay */}
      {selected && mode && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) close(); }}
        >
          <div className="bg-[#0f172a] border border-slate-700 rounded-xl p-6 w-full max-w-md mx-4 flex flex-col gap-5">

            {/* Edit subscription */}
            {mode === "edit" && (
              <>
                <div>
                  <h3 className="text-sm font-semibold text-slate-100">サブスクリプション編集</h3>
                  <p className="text-xs text-slate-500 mt-0.5">{selected.name}</p>
                </div>
                <div className="flex flex-col gap-3">
                  {/* Plan */}
                  <label className="flex flex-col gap-1">
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider">プラン</span>
                    <select
                      value={editPlan}
                      onChange={(e) => setEditPlan(e.target.value as PlanCode)}
                      className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-slate-500"
                    >
                      {planOptions.map((p) => (
                        <option key={p} value={p}>{getPlanLabel(p)}</option>
                      ))}
                    </select>
                  </label>
                  {/* Status */}
                  <label className="flex flex-col gap-1">
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider">ステータス</span>
                    <select
                      value={editStatus}
                      onChange={(e) => setEditStatus(e.target.value as SubscriptionStatus)}
                      className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-slate-500"
                    >
                      {statusOptions.map((s) => (
                        <option key={s} value={s}>{getStatusLabel(s)}</option>
                      ))}
                    </select>
                  </label>
                  {/* Trial end */}
                  <label className="flex flex-col gap-1">
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider">トライアル終了日</span>
                    <input
                      type="date"
                      value={trialEnd}
                      onChange={(e) => setTrialEnd(e.target.value)}
                      className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-slate-500"
                    />
                  </label>
                  {/* Period start */}
                  <label className="flex flex-col gap-1">
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider">契約開始日</span>
                    <input
                      type="date"
                      value={periodStart}
                      onChange={(e) => setPeriodStart(e.target.value)}
                      className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-slate-500"
                    />
                  </label>
                  {/* Period end */}
                  <label className="flex flex-col gap-1">
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider">有効期限</span>
                    <input
                      type="date"
                      value={periodEnd}
                      onChange={(e) => setPeriodEnd(e.target.value)}
                      className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-slate-500"
                    />
                  </label>
                  {/* Notes */}
                  <label className="flex flex-col gap-1">
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider">メモ</span>
                    <textarea
                      value={noteText}
                      onChange={(e) => setNoteText(e.target.value)}
                      rows={2}
                      placeholder="管理者メモ (任意)"
                      className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-slate-500 resize-none"
                    />
                  </label>
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    onClick={close}
                    className="text-xs px-4 py-2 rounded-lg border border-slate-700 text-slate-400 hover:text-slate-200 transition-colors"
                  >
                    キャンセル
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={isPending}
                    className="text-xs px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50 transition-colors"
                  >
                    {isPending ? "保存中..." : "保存"}
                  </button>
                </div>
              </>
            )}

            {/* Extend trial */}
            {mode === "trial" && (
              <>
                <div>
                  <h3 className="text-sm font-semibold text-slate-100">トライアル延長</h3>
                  <p className="text-xs text-slate-500 mt-0.5">{selected.name}</p>
                </div>
                <label className="flex flex-col gap-1">
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider">新しいトライアル終了日</span>
                  <input
                    type="date"
                    value={trialEnd}
                    onChange={(e) => setTrialEnd(e.target.value)}
                    className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-slate-500"
                  />
                </label>
                <div className="flex justify-end gap-2">
                  <button
                    onClick={close}
                    className="text-xs px-4 py-2 rounded-lg border border-slate-700 text-slate-400 hover:text-slate-200 transition-colors"
                  >
                    キャンセル
                  </button>
                  <button
                    onClick={handleExtendTrial}
                    disabled={isPending || !trialEnd}
                    className="text-xs px-4 py-2 rounded-lg bg-amber-600 text-white hover:bg-amber-500 disabled:opacity-50 transition-colors"
                  >
                    {isPending ? "更新中..." : "延長する"}
                  </button>
                </div>
              </>
            )}

            {/* Update note */}
            {mode === "note" && (
              <>
                <div>
                  <h3 className="text-sm font-semibold text-slate-100">管理者メモ</h3>
                  <p className="text-xs text-slate-500 mt-0.5">{selected.name}</p>
                </div>
                <label className="flex flex-col gap-1">
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider">メモ</span>
                  <textarea
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    rows={4}
                    placeholder="管理者メモを入力..."
                    className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-slate-500 resize-none"
                  />
                </label>
                <div className="flex justify-end gap-2">
                  <button
                    onClick={close}
                    className="text-xs px-4 py-2 rounded-lg border border-slate-700 text-slate-400 hover:text-slate-200 transition-colors"
                  >
                    キャンセル
                  </button>
                  <button
                    onClick={handleSaveNote}
                    disabled={isPending}
                    className="text-xs px-4 py-2 rounded-lg bg-slate-600 text-white hover:bg-slate-500 disabled:opacity-50 transition-colors"
                  >
                    {isPending ? "保存中..." : "保存"}
                  </button>
                </div>
              </>
            )}

          </div>
        </div>
      )}
    </div>
  );
}
