"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  MaintenanceReminderDB,
  maintenanceReminderTypeLabel,
  maintenanceReminderStatusLabel,
  maintenanceReminderDisplayNo,
  maintenanceCustomerName,
  maintenanceVehicleLabel,
  MaintenanceReminderStatus,
} from "@/lib/maintenance/maintenance-types";
import { queueMaintenanceReminder } from "@/lib/maintenance/queue-maintenance-reminder";
import { deleteMaintenanceReminder } from "@/lib/maintenance/delete-maintenance-reminder";

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-start gap-4 py-2 border-b border-slate-700/50 last:border-b-0">
      <span className="text-xs text-slate-500 shrink-0 w-32">{label}</span>
      <span className="text-xs text-slate-200 text-right break-all">{value}</span>
    </div>
  );
}

const STATUS_BADGE: Record<MaintenanceReminderStatus, string> = {
  scheduled:  "bg-blue-600/80 text-blue-100",
  queued:     "bg-amber-600 text-white",
  sent:       "bg-green-600 text-white",
  completed:  "bg-green-700 text-white",
  cancelled:  "bg-slate-600 text-slate-300",
  failed:     "bg-red-600 text-white",
};

export default function ReminderPageClient({ reminder: r }: { reminder: MaintenanceReminderDB }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleQueue() {
    startTransition(async () => {
      const result = await queueMaintenanceReminder(r.id);
      if ("error" in result) { alert(result.error); return; }
      router.refresh();
    });
  }

  function handleDelete() {
    if (!confirm(`${maintenanceReminderDisplayNo(r)} を削除しますか？`)) return;
    startTransition(async () => {
      await deleteMaintenanceReminder(r.id);
      router.push("/maintenance");
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2">
        <a href="/maintenance" className="text-xs text-slate-400 hover:text-slate-200">
          ← メンテナンス管理
        </a>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold text-slate-100">
              {maintenanceReminderDisplayNo(r)}
            </h1>
            <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${STATUS_BADGE[r.status]}`}>
              {maintenanceReminderStatusLabel(r.status)}
            </span>
          </div>
          {r.title && <p className="text-sm text-slate-400 mt-1">{r.title}</p>}
        </div>
        <div className="flex gap-2">
          {r.status === "scheduled" && (
            <button type="button" disabled={isPending} onClick={handleQueue}
              className="text-xs bg-[#06C755]/10 text-[#06C755] border border-[#06C755]/30 hover:bg-[#06C755]/20 px-4 py-2 rounded-lg transition-colors disabled:opacity-40">
              {isPending ? "処理中..." : "LINEキュー登録"}
            </button>
          )}
          <a href={`/maintenance/${r.id}/edit`}
            className="text-xs bg-slate-700 hover:bg-slate-600 text-slate-200 px-4 py-2 rounded-lg transition-colors">
            編集
          </a>
        </div>
      </div>

      {/* Detail cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-[#1e293b] rounded-xl p-5">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">リマインダー情報</h3>
          <InfoRow label="種別"      value={maintenanceReminderTypeLabel(r.reminder_type)} />
          <InfoRow label="予定日"    value={r.due_date?.slice(0, 10) ?? "—"} />
          <InfoRow label="LINE送信予定" value={r.scheduled_send_at?.replace("T", " ").slice(0, 16) ?? "—"} />
          <InfoRow label="送信日時"  value={r.sent_at?.replace("T", " ").slice(0, 16) ?? "—"} />
        </div>

        <div className="bg-[#1e293b] rounded-xl p-5">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">顧客・車両</h3>
          <InfoRow label="顧客名"    value={maintenanceCustomerName(r)} />
          {r.customers?.phone && <InfoRow label="電話" value={r.customers.phone} />}
          <InfoRow label="車両"      value={maintenanceVehicleLabel(r)} />
          {r.work_orders?.work_order_number && (
            <InfoRow label="作業指示書" value={r.work_orders.work_order_number} />
          )}
        </div>
      </div>

      {/* Message */}
      {(r.message_title || r.message_body) && (
        <div className="bg-[#1e293b] rounded-xl p-5">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">LINEメッセージ</h3>
          {r.message_title && (
            <p className="text-sm font-medium text-slate-200 mb-3">{r.message_title}</p>
          )}
          {r.message_body && (
            <p className="text-xs text-slate-300 whitespace-pre-wrap">{r.message_body}</p>
          )}
        </div>
      )}

      {/* LINE Queue status */}
      {r.line_queue_id && (
        <div className="bg-[#1e293b] border border-green-700/20 rounded-xl p-5">
          <h3 className="text-xs font-semibold text-green-400/80 uppercase tracking-wider mb-2">LINE通知キュー</h3>
          <p className="text-xs text-slate-400">Queue ID: {r.line_queue_id}</p>
          <p className="text-xs text-slate-500 mt-1">
            /line ページのキュー処理で実際の送信が行われます
          </p>
        </div>
      )}

      {r.notes && (
        <div className="bg-[#1e293b] rounded-xl p-5">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">備考</h3>
          <p className="text-xs text-slate-300 whitespace-pre-wrap">{r.notes}</p>
        </div>
      )}

      {r.internal_memo && (
        <div className="bg-[#1e293b] border border-slate-700 rounded-xl p-5">
          <h3 className="text-xs font-semibold text-amber-500/80 uppercase tracking-wider mb-2">内部メモ</h3>
          <p className="text-xs text-slate-300 whitespace-pre-wrap">{r.internal_memo}</p>
        </div>
      )}

      {/* Delete */}
      <div className="flex justify-end pt-2 border-t border-slate-800">
        <button type="button" disabled={isPending} onClick={handleDelete}
          className="text-xs text-red-400 hover:text-red-300 px-3 py-1.5 rounded transition-colors disabled:opacity-40">
          このリマインダーを削除
        </button>
      </div>
    </div>
  );
}
