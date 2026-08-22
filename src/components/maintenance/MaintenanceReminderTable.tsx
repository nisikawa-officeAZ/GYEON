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
import { GdaOperationalListEmptyState } from "@/components/ui/GdaOperationalListSurface";

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
      <GdaOperationalListEmptyState
        messageJa="メンテナンス予定がありません"
        messageEn="NO MAINTENANCE REMINDERS"
      />
    );
  }

  return (
    <>
      {/* Desktop / tablet (>=768px): table-first presentation. */}
      <div className="hidden md:block">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#20304a]">
                <th className="text-left text-xs font-medium text-[#7788a4] px-3 py-2.5 lg:px-4 lg:py-3">番号</th>
                <th className="text-left text-xs font-medium text-[#7788a4] px-3 py-2.5 lg:px-4 lg:py-3">顧客名</th>
                <th className="text-left text-xs font-medium text-[#7788a4] px-3 py-2.5 lg:px-4 lg:py-3 hidden md:table-cell">車両</th>
                <th className="text-left text-xs font-medium text-[#7788a4] px-3 py-2.5 lg:px-4 lg:py-3 hidden lg:table-cell">種別</th>
                <th className="text-center text-xs font-medium text-[#7788a4] px-3 py-2.5 lg:px-4 lg:py-3">ステータス</th>
                <th className="text-left text-xs font-medium text-[#7788a4] px-3 py-2.5 lg:px-4 lg:py-3">予定日</th>
                <th className="text-left text-xs font-medium text-[#7788a4] px-3 py-2.5 lg:px-4 lg:py-3 hidden xl:table-cell">LINE送信予定</th>
                <th className="text-left text-xs font-medium text-[#7788a4] px-3 py-2.5 lg:px-4 lg:py-3 hidden xl:table-cell">送信済日時</th>
                <th className="px-3 py-2.5 lg:px-4 lg:py-3" />
              </tr>
            </thead>
            <tbody>
              {reminders.map((r, i) => (
                <tr
                  key={r.id}
                  className={`border-b border-[#1a2740] hover:bg-[#141e2f] transition-colors ${
                    i === reminders.length - 1 ? "border-b-0" : ""
                  }`}
                >
                  <td className="px-3 py-2.5 lg:px-4 lg:py-3 text-xs text-[#7788a4] whitespace-nowrap font-mono">
                    {maintenanceReminderDisplayNo(r)}
                  </td>
                  <td className="px-3 py-2.5 lg:px-4 lg:py-3">
                    <p className="text-xs text-[#edf3fc] font-medium whitespace-nowrap">
                      {maintenanceCustomerName(r)}
                    </p>
                    {r.title && (
                      <p className="text-[10px] text-[#7788a4] mt-0.5 truncate max-w-[140px]">{r.title}</p>
                    )}
                  </td>
                  <td className="px-3 py-2.5 lg:px-4 lg:py-3 text-xs text-[#8191ad] hidden md:table-cell max-w-[160px] truncate">
                    {maintenanceVehicleLabel(r)}
                  </td>
                  <td className="px-3 py-2.5 lg:px-4 lg:py-3 hidden lg:table-cell">
                    <span className="text-[10px] text-[#8191ad]">
                      {maintenanceReminderTypeLabel(r.reminder_type)}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 lg:px-4 lg:py-3 text-center">
                    <span className={`inline-block text-[10px] px-1.5 py-0.5 rounded border ${STATUS_STYLE[r.status]}`}>
                      {maintenanceReminderStatusLabel(r.status)}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 lg:px-4 lg:py-3 text-xs text-[#c3cee2] whitespace-nowrap">
                    {formatDate(r.due_date)}
                  </td>
                  <td className="px-3 py-2.5 lg:px-4 lg:py-3 text-xs text-[#7788a4] hidden xl:table-cell whitespace-nowrap">
                    {formatDatetime(r.scheduled_send_at)}
                  </td>
                  <td className="px-3 py-2.5 lg:px-4 lg:py-3 text-xs text-[#7788a4] hidden xl:table-cell whitespace-nowrap">
                    {formatDatetime(r.sent_at)}
                  </td>
                  <td className="px-3 py-2.5 lg:px-4 lg:py-3">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => onDetail(r)}
                        className="text-xs text-[#8191ad] hover:text-[#edf3fc] hover:bg-[#1a2740] px-2.5 py-2 rounded-lg transition-colors min-h-[36px]"
                      >
                        詳細
                      </button>
                      <button
                        type="button"
                        onClick={() => onEdit(r)}
                        className="text-xs text-[#8191ad] hover:text-[#edf3fc] hover:bg-[#1a2740] px-2.5 py-2 rounded-lg transition-colors min-h-[36px]"
                      >
                        編集
                      </button>
                      {r.status === "scheduled" && (
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => handleQueue(r)}
                          className="text-xs text-[#06C755] hover:text-white hover:bg-[#06C755]/20 px-2.5 py-2 rounded-lg transition-colors disabled:opacity-40 whitespace-nowrap min-h-[36px]"
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

      {/* Mobile (<768px): stacked records replace the wide table. */}
      <div className="flex flex-col gap-3 p-3 md:hidden">
        {reminders.map((r) => (
          <div key={r.id} className="rounded-2xl border border-[#263955] bg-[#0d1420] p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-[15px] font-bold text-[#edf3fc]">{maintenanceCustomerName(r)}</p>
                <p className="truncate text-[11px] text-[#7788a4] font-mono">{maintenanceReminderDisplayNo(r)}</p>
              </div>
              <span className={`shrink-0 inline-block text-[10px] px-1.5 py-0.5 rounded border ${STATUS_STYLE[r.status]}`}>
                {maintenanceReminderStatusLabel(r.status)}
              </span>
            </div>

            <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-[12px]">
              <div>
                <dt className="text-[#7788a4]">車両</dt>
                <dd className="truncate text-[#c3cee2]">{maintenanceVehicleLabel(r)}</dd>
              </div>
              <div>
                <dt className="text-[#7788a4]">種別</dt>
                <dd className="text-[#c3cee2]">{maintenanceReminderTypeLabel(r.reminder_type)}</dd>
              </div>
              <div>
                <dt className="text-[#7788a4]">予定日</dt>
                <dd className="text-[#c3cee2]">{formatDate(r.due_date)}</dd>
              </div>
              <div>
                <dt className="text-[#7788a4]">LINE送信予定</dt>
                <dd className="text-[#c3cee2]">{formatDatetime(r.scheduled_send_at)}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-[#7788a4]">送信済日時</dt>
                <dd className="text-[#c3cee2]">{formatDatetime(r.sent_at)}</dd>
              </div>
            </dl>

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => onDetail(r)}
                className="min-h-[44px] flex-1 rounded-xl border border-[#263955] text-xs font-medium text-[#8191ad] hover:text-[#edf3fc] hover:bg-[#1a2740] transition-colors"
              >
                詳細
              </button>
              <button
                type="button"
                onClick={() => onEdit(r)}
                className="min-h-[44px] flex-1 rounded-xl border border-[#263955] text-xs font-medium text-[#8191ad] hover:text-[#edf3fc] hover:bg-[#1a2740] transition-colors"
              >
                編集
              </button>
              {r.status === "scheduled" && (
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => handleQueue(r)}
                  className="min-h-[44px] flex-1 rounded-xl border border-[#06C755]/40 text-xs font-medium text-[#06C755] hover:bg-[#06C755]/20 transition-colors disabled:opacity-40"
                >
                  キュー登録
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
