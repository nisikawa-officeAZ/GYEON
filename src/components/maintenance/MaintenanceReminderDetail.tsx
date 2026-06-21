"use client";

import { useTransition } from "react";
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

function formatDate(iso: string | null): string {
  return iso ? iso.slice(0, 10) : "—";
}

function formatDatetime(iso: string | null): string {
  if (!iso) return "—";
  return iso.replace("T", " ").slice(0, 16);
}

const STATUS_BADGE: Record<MaintenanceReminderStatus, string> = {
  scheduled:  "bg-blue-600/80 text-blue-100",
  queued:     "bg-amber-600 text-white",
  sent:       "bg-green-600 text-white",
  completed:  "bg-green-700 text-white",
  cancelled:  "bg-slate-600 text-slate-300",
  failed:     "bg-red-600 text-white",
};

interface Props {
  reminder:  MaintenanceReminderDB;
  onClose:   () => void;
  onEdit:    () => void;
  onChanged: () => void;
}

export default function MaintenanceReminderDetail({ reminder: r, onClose, onEdit, onChanged }: Props) {
  const [isPending, startTransition] = useTransition();

  function handleQueue() {
    startTransition(async () => {
      const result = await queueMaintenanceReminder(r.id);
      if ("error" in result) {
        alert(result.error);
        return;
      }
      onChanged();
    });
  }

  function handleDelete() {
    if (!confirm(`${maintenanceReminderDisplayNo(r)} を削除してもよろしいですか？`)) return;
    startTransition(async () => {
      await deleteMaintenanceReminder(r.id);
      onClose();
      onChanged();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto">
      <div className="fixed inset-0 bg-[#0f172a]/80 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-2xl bg-[#0f172a] rounded-xl shadow-lg my-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-slate-100">
                {maintenanceReminderDisplayNo(r)}
              </h2>
              <span className={`text-[10px] font-medium px-2 py-0.5 rounded ${STATUS_BADGE[r.status] ?? "bg-slate-700 text-slate-300"}`}>
                {maintenanceReminderStatusLabel(r.status)}
              </span>
            </div>
            {r.title && <p className="text-xs text-slate-400 mt-0.5">{r.title}</p>}
            <p className="text-xs text-slate-500 mt-0.5">メンテナンスリマインダー</p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-100 text-lg leading-none">✕</button>
        </div>

        <div className="p-6 flex flex-col gap-4">
          {/* Basic info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-[#1e293b] rounded-xl p-5">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">リマインダー情報</h3>
              <InfoRow label="種別"      value={maintenanceReminderTypeLabel(r.reminder_type)} />
              <InfoRow label="予定日"    value={formatDate(r.due_date)} />
              <InfoRow label="送信予定"  value={formatDatetime(r.scheduled_send_at)} />
              <InfoRow label="送信日時"  value={formatDatetime(r.sent_at)} />
            </div>

            <div className="bg-[#1e293b] rounded-xl p-5">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">顧客・車両</h3>
              <InfoRow label="顧客名"    value={maintenanceCustomerName(r)} />
              {r.customers?.phone && (
                <InfoRow label="電話"    value={r.customers.phone} />
              )}
              <InfoRow label="車両"      value={maintenanceVehicleLabel(r)} />
              {r.work_orders && (
                <InfoRow label="作業指示書" value={r.work_orders.work_order_number ?? "—"} />
              )}
            </div>
          </div>

          {/* Message */}
          {(r.message_title || r.message_body) && (
            <div className="bg-[#1e293b] rounded-xl p-5">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">LINEメッセージ</h3>
              {r.message_title && (
                <p className="text-xs font-medium text-slate-200 mb-2">{r.message_title}</p>
              )}
              {r.message_body && (
                <p className="text-xs text-slate-300 whitespace-pre-wrap">{r.message_body}</p>
              )}
            </div>
          )}

          {/* LINE Queue */}
          {r.line_queue_id && (
            <div className="bg-[#1e293b] border border-green-700/30 rounded-xl p-5">
              <h3 className="text-xs font-semibold text-green-400/80 uppercase tracking-wider mb-2">
                LINE通知キュー
              </h3>
              <p className="text-xs text-slate-400">Queue ID: {r.line_queue_id}</p>
            </div>
          )}

          {/* Notes */}
          {r.notes && (
            <div className="bg-[#1e293b] rounded-xl p-5">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">備考</h3>
              <p className="text-xs text-slate-300 whitespace-pre-wrap">{r.notes}</p>
            </div>
          )}

          {/* Internal memo */}
          {r.internal_memo && (
            <div className="bg-[#1e293b] border border-slate-700 rounded-xl p-5">
              <h3 className="text-xs font-semibold text-amber-500/80 uppercase tracking-wider mb-2">
                内部メモ（社内のみ）
              </h3>
              <p className="text-xs text-slate-300 whitespace-pre-wrap">{r.internal_memo}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-800">
            <button
              type="button"
              disabled={isPending}
              onClick={handleDelete}
              className="text-xs text-red-400 hover:text-red-300 px-3 py-1.5 rounded transition-colors disabled:opacity-40"
            >
              削除
            </button>
            <div className="flex gap-2">
              {r.status === "scheduled" && (
                <button
                  type="button"
                  disabled={isPending}
                  onClick={handleQueue}
                  className="text-xs bg-[#06C755]/10 hover:bg-[#06C755]/20 text-[#06C755] border border-[#06C755]/30 px-4 py-1.5 rounded-lg transition-colors disabled:opacity-40"
                >
                  {isPending ? "処理中..." : "LINEキュー登録"}
                </button>
              )}
              <button
                type="button"
                onClick={onEdit}
                className="text-xs bg-slate-700 hover:bg-slate-600 text-slate-200 px-4 py-1.5 rounded-lg transition-colors"
              >
                編集
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
