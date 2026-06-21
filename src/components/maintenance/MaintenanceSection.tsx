"use client";

// Lazy maintenance reminder section for WorkOrderDetail.
// Shows existing reminders + create button.

import { useState, useEffect, useTransition } from "react";
import {
  MaintenanceReminderDB,
  maintenanceReminderStatusLabel,
  maintenanceReminderDisplayNo,
  MaintenanceReminderStatus,
} from "@/lib/maintenance/maintenance-types";
import { getMaintenanceRemindersByWorkOrder } from "@/lib/maintenance/get-maintenance-reminders";

type DetailView = "list" | "create";

const STATUS_BADGE: Record<MaintenanceReminderStatus, string> = {
  scheduled:  "bg-blue-500/10 text-blue-400",
  queued:     "bg-amber-500/10 text-amber-400",
  sent:       "bg-green-500/10 text-green-400",
  completed:  "bg-green-600/10 text-green-300",
  cancelled:  "bg-slate-600/10 text-slate-500",
  failed:     "bg-red-500/10 text-red-400",
};

function formatDate(iso: string | null): string {
  return iso ? iso.slice(0, 10) : "—";
}

interface Props {
  workOrderId:  string;
  customerId:   string;
  vehicleId?:   string | null;
  isCompleted?: boolean;
}

export default function MaintenanceSection({
  workOrderId,
  customerId,
  vehicleId,
  isCompleted,
}: Props) {
  const [reminders, setReminders] = useState<MaintenanceReminderDB[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [view,      setView]      = useState<DetailView>("list");
  const [, startTransition] = useTransition();

  async function load() {
    setLoading(true);
    const data = await getMaintenanceRemindersByWorkOrder(workOrderId);
    setReminders(data);
    setLoading(false);
  }

  useEffect(() => { load(); }, [workOrderId]);

  if (loading) {
    return <p className="text-xs text-slate-500 text-center py-4">読み込み中...</p>;
  }

  // Redirect to /maintenance/new with params
  function handleCreate() {
    const params = new URLSearchParams({
      customer_id:   customerId,
      work_order_id: workOrderId,
      ...(vehicleId ? { vehicle_id: vehicleId } : {}),
    });
    window.location.href = `/maintenance/new?${params}`;
  }

  return (
    <div className="flex flex-col gap-3">
      {isCompleted && reminders.length === 0 && (
        <div className="bg-green-900/10 border border-green-700/30 rounded-lg px-4 py-3 flex items-center justify-between">
          <p className="text-xs text-green-400">
            施工完了 — メンテナンス通知を設定しておくと再来店促進になります
          </p>
        </div>
      )}

      {reminders.length === 0 ? (
        <p className="text-xs text-slate-500 text-center py-4">メンテナンス予定がありません</p>
      ) : (
        <div className="flex flex-col gap-2">
          {reminders.map((r) => (
            <div
              key={r.id}
              className="flex items-center justify-between bg-[#0f172a] rounded-lg px-4 py-3"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-slate-500">
                    {maintenanceReminderDisplayNo(r)}
                  </span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${STATUS_BADGE[r.status]}`}>
                    {maintenanceReminderStatusLabel(r.status)}
                  </span>
                </div>
                <p className="text-xs text-slate-200 mt-0.5">
                  {r.title ?? "メンテナンス通知"}
                </p>
                <p className="text-[10px] text-slate-500">予定日: {formatDate(r.due_date)}</p>
              </div>
              <a
                href={`/maintenance/${r.id}`}
                className="text-xs text-slate-400 hover:text-slate-100 hover:bg-slate-700 px-2 py-1 rounded transition-colors"
              >
                詳細
              </a>
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={handleCreate}
        className={`text-xs px-4 py-2 rounded-lg border transition-colors ${
          isCompleted && reminders.length === 0
            ? "border-green-600/40 text-green-400 hover:bg-green-900/20"
            : "border-slate-700 text-slate-400 hover:text-slate-200 hover:bg-slate-800"
        }`}
      >
        + メンテナンス予定を作成
      </button>
    </div>
  );
}
