"use client";

import { useState, useTransition } from "react";
import MaintenanceReminderTable  from "@/components/maintenance/MaintenanceReminderTable";
import MaintenanceReminderDetail from "@/components/maintenance/MaintenanceReminderDetail";
import MaintenanceReminderForm   from "@/components/maintenance/MaintenanceReminderForm";
import {
  MaintenanceReminderDB,
  MaintenanceReminderStatus,
  maintenanceReminderStatusLabel,
  MAINTENANCE_REMINDER_STATUSES,
} from "@/lib/maintenance/maintenance-types";
import { getMaintenanceReminders } from "@/lib/maintenance/get-maintenance-reminders";
import { processDueMaintenanceReminders } from "@/lib/maintenance/process-due-maintenance-reminders";

interface MaintenanceStats {
  this_month:      number;
  next_7_days:     number;
  pending:         number;
  sent_this_month: number;
}

function StatCard({
  label, value, sub, accent,
}: {
  label: string; value: string | number; sub?: string;
  accent?: "green" | "blue" | "red" | "amber";
}) {
  const color =
    accent === "green" ? "text-green-400" :
    accent === "red"   ? "text-red-400"   :
    accent === "amber" ? "text-amber-400" :
    accent === "blue"  ? "text-blue-400"  :
    "text-slate-100";
  return (
    <div className="bg-[#0f172a] border border-slate-800 rounded-xl p-5">
      <p className="text-xs text-slate-500 mb-2">{label}</p>
      <p className={`text-2xl font-bold tracking-tight ${color}`}>{value}</p>
      {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
    </div>
  );
}

type ModalState =
  | { mode: "none" }
  | { mode: "detail"; reminder: MaintenanceReminderDB }
  | { mode: "edit";   reminder: MaintenanceReminderDB };

interface Props {
  initialReminders: MaintenanceReminderDB[];
  stats:            MaintenanceStats;
}

export default function MaintenanceClient({ initialReminders, stats }: Props) {
  const [reminders, setReminders] = useState(initialReminders);
  const [modal, setModal]         = useState<ModalState>({ mode: "none" });
  const [statusFilter, setStatusFilter] = useState<MaintenanceReminderStatus | "all">("all");
  const [processMsg, setProcessMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function reload(status?: MaintenanceReminderStatus | "all") {
    const s = status ?? statusFilter;
    const data = await getMaintenanceReminders(
      s === "all" ? { limit: 100 } : { status: s, limit: 100 }
    );
    setReminders(data);
  }

  function handleProcessDue() {
    startTransition(async () => {
      setProcessMsg(null);
      const result = await processDueMaintenanceReminders();
      if ("error" in result) {
        setProcessMsg(`エラー: ${result.error}`);
        return;
      }
      setProcessMsg(
        `処理完了: ${result.processed}件 / キュー登録${result.queued}件 / 失敗${result.failed}件`
      );
      await reload();
    });
  }

  const displayed = statusFilter === "all"
    ? reminders
    : reminders.filter((r) => r.status === statusFilter);

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-lg font-semibold text-slate-100">メンテナンス通知管理</h1>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={isPending}
            onClick={handleProcessDue}
            className="text-xs bg-[#1d4ed8] hover:bg-[#1e40af] text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-40"
          >
            {isPending ? "処理中..." : "期限到達分をキュー処理"}
          </button>
          <a
            href="/maintenance/new"
            className="text-xs bg-[#0f172a] border border-slate-700 hover:bg-slate-800 text-slate-200 px-4 py-2 rounded-lg transition-colors"
          >
            + 新規作成
          </a>
        </div>
      </div>

      {processMsg && (
        <div className={`text-xs px-4 py-2 rounded-lg ${
          processMsg.startsWith("エラー")
            ? "bg-red-900/20 text-red-400"
            : "bg-green-900/20 text-green-400"
        }`}>
          {processMsg}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="今月の予定"     value={stats.this_month}      accent="blue" />
        <StatCard label="7日以内の送信"  value={stats.next_7_days}     accent="amber" />
        <StatCard label="未送信(予定+キュー)" value={stats.pending}   accent={stats.pending > 0 ? "red" : undefined} />
        <StatCard label="今月送信済み"   value={stats.sent_this_month} accent="green" />
      </div>

      {/* Status filter tabs */}
      <div className="flex border-b border-slate-700 gap-1">
        <button
          type="button"
          onClick={() => { setStatusFilter("all"); reload("all"); }}
          className={`px-4 py-2 text-xs font-medium border-b-2 -mb-px transition-colors ${
            statusFilter === "all"
              ? "border-[#1d4ed8] text-blue-400"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          すべて ({reminders.length})
        </button>
        {MAINTENANCE_REMINDER_STATUSES.map((s) => {
          const count = reminders.filter((r) => r.status === s).length;
          return (
            <button
              key={s}
              type="button"
              onClick={() => { setStatusFilter(s); reload(s); }}
              className={`px-4 py-2 text-xs font-medium border-b-2 -mb-px transition-colors ${
                statusFilter === s
                  ? "border-[#1d4ed8] text-blue-400"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              {maintenanceReminderStatusLabel(s)} ({count})
            </button>
          );
        })}
      </div>

      <MaintenanceReminderTable
        reminders={displayed}
        onDetail={(r) => setModal({ mode: "detail", reminder: r })}
        onEdit={(r)   => setModal({ mode: "edit",   reminder: r })}
        onQueued={reload}
      />

      {/* Detail modal */}
      {modal.mode === "detail" && (
        <MaintenanceReminderDetail
          reminder={modal.reminder}
          onClose={() => setModal({ mode: "none" })}
          onEdit={() => setModal({ mode: "edit", reminder: modal.reminder })}
          onChanged={reload}
        />
      )}

      {/* Edit modal */}
      {modal.mode === "edit" && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto">
          <div className="fixed inset-0 bg-[#0f172a]/80 backdrop-blur-sm"
            onClick={() => setModal({ mode: "none" })} />
          <div className="relative w-full max-w-2xl bg-[#0f172a] rounded-xl shadow-lg my-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
              <h2 className="text-base font-semibold text-slate-100">リマインダー編集</h2>
              <button onClick={() => setModal({ mode: "none" })}
                className="text-slate-500 hover:text-slate-100 text-lg">✕</button>
            </div>
            <div className="p-6">
              <MaintenanceReminderForm
                reminder={modal.reminder}
                onSaved={async (saved) => {
                  setModal({ mode: "none" });
                  await reload();
                }}
                onCancel={() => setModal({ mode: "none" })}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
