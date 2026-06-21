"use client";

import { useTransition } from "react";
import {
  MaintenanceReminderDB,
  MaintenanceReminderStatus,
  maintenanceReminderTypeLabel,
  maintenanceReminderStatusLabel,
  maintenanceReminderDisplayNo,
  maintenanceCustomerName,
  maintenanceVehicleLabel,
} from "@/lib/maintenance/maintenance-types";
import { queueMaintenanceReminder } from "@/lib/maintenance/queue-maintenance-reminder";

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return iso.slice(0, 10);
}

function formatDatetime(iso: string | null): string {
  if (!iso) return "—";
  return iso.replace("T", " ").slice(0, 16);
}

const STATUS_STYLE: Record<MaintenanceReminderStatus, string> = {
  scheduled:  "bg-blue-500/10 text-blue-400 border-blue-500/20",
  queued:     "bg-amber-500/10 text-amber-400 border-amber-500/20",
  sent:       "bg-green-500/10 text-green-400 border-green-500/20",
  completed:  "bg-green-600/10 text-green-300 border-green-600/20",
  cancelled:  "bg-slate-600/10 text-slate-500 border-slate-600/20",
  failed:     "bg-red-500/10 text-red-400 border-red-500/20",
};

interface Props {
  reminders: MaintenanceReminderDB[];
  onDetail:  (r: MaintenanceReminderDB) => void;
  onEdit:    (r: MaintenanceReminderDB) => void;
  onQueued?: () => void;
}

export default function MaintenanceReminderTable({
  reminders,
  onDetail,
  onEdit,
  onQueued,
}: Props) {
  const [isPending, startTransition] = useTransition();

  function handleQueue(r: MaintenanceReminderDB) {
    startTransition(async () => {
      const result = await queueMaintenanceReminder(r.id);
      if ("error" in result) {
        alert(result.error);
        return;
      }
      onQueued?.();
    });
  }

  if (reminders.length === 0) {
    return (
      <div className="bg-[#1e293b] rounded-xl shadow-lg p-10 text-center">
        <p className="text-sm text-slate-500">メンテナンス予定がありません</p>
      </div>
    );
  }

  return (
    <div className="bg-[#1e293b] rounded-xl shadow-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700">
              <th className="text-left text-xs font-medium text-slate-400 px-4 py-3">番号</th>
              <th className="text-left text-xs font-medium text-slate-400 px-4 py-3">顧客名</th>
              <th className="text-left text-xs font-medium text-slate-400 px-4 py-3 hidden md:table-cell">車両</th>
              <th className="text-left text-xs font-medium text-slate-400 px-4 py-3 hidden lg:table-cell">種別</th>
              <th className="text-center text-xs font-medium text-slate-400 px-4 py-3">ステータス</th>
              <th className="text-left text-xs font-medium text-slate-400 px-4 py-3">予定日</th>
              <th className="text-left text-xs font-medium text-slate-400 px-4 py-3 hidden xl:table-cell">LINE送信予定</th>
              <th className="text-left text-xs font-medium text-slate-400 px-4 py-3 hidden xl:table-cell">送信済日時</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {reminders.map((r, i) => (
              <tr
                key={r.id}
                className={`border-b border-slate-800 hover:bg-slate-700/30 transition-colors ${
                  i === reminders.length - 1 ? "border-b-0" : ""
                }`}
              >
                <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap font-mono">
                  {maintenanceReminderDisplayNo(r)}
                </td>
                <td className="px-4 py-3">
                  <p className="text-xs text-slate-100 font-medium whitespace-nowrap">
                    {maintenanceCustomerName(r)}
                  </p>
                  {r.title && (
                    <p className="text-[10px] text-slate-500 mt-0.5 truncate max-w-[140px]">{r.title}</p>
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-slate-400 hidden md:table-cell max-w-[160px] truncate">
                  {maintenanceVehicleLabel(r)}
                </td>
                <td className="px-4 py-3 hidden lg:table-cell">
                  <span className="text-[10px] text-slate-400">
                    {maintenanceReminderTypeLabel(r.reminder_type)}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`inline-block text-[10px] px-1.5 py-0.5 rounded border ${STATUS_STYLE[r.status]}`}>
                    {maintenanceReminderStatusLabel(r.status)}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-slate-300 whitespace-nowrap">
                  {formatDate(r.due_date)}
                </td>
                <td className="px-4 py-3 text-xs text-slate-500 hidden xl:table-cell whitespace-nowrap">
                  {formatDatetime(r.scheduled_send_at)}
                </td>
                <td className="px-4 py-3 text-xs text-slate-500 hidden xl:table-cell whitespace-nowrap">
                  {formatDatetime(r.sent_at)}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => onDetail(r)}
                      className="text-xs text-slate-400 hover:text-slate-100 hover:bg-slate-700 px-2 py-1 rounded transition-colors"
                    >
                      詳細
                    </button>
                    <button
                      type="button"
                      onClick={() => onEdit(r)}
                      className="text-xs text-slate-400 hover:text-slate-100 hover:bg-slate-700 px-2 py-1 rounded transition-colors"
                    >
                      編集
                    </button>
                    {r.status === "scheduled" && (
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => handleQueue(r)}
                        className="text-xs text-[#06C755] hover:text-white hover:bg-[#06C755]/20 px-2 py-1 rounded transition-colors disabled:opacity-40 whitespace-nowrap"
                      >
                        キュー登録
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
  );
}
