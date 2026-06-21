"use client";

// PHASE66-B: Today reservations card.
// Shows today's work orders as the operational schedule.
// Reservation list data is available via today_work_orders in DashboardSummary.

import type { TodayWorkOrder } from "@/lib/dashboard/get-dashboard-summary";
import Link from "next/link";

const STATUS_BADGE: Record<string, string> = {
  scheduled:   "bg-blue-600/80 text-blue-100",
  in_progress: "bg-amber-600 text-white",
  completed:   "bg-green-600/80 text-white",
  cancelled:   "bg-slate-700 text-slate-400",
  on_hold:     "bg-orange-600 text-white",
};

const STATUS_LABEL: Record<string, string> = {
  scheduled:   "予定",
  in_progress: "施工中",
  completed:   "完了",
  cancelled:   "キャンセル",
  on_hold:     "保留",
};

function fmt(iso: string | null): string {
  if (!iso) return "—";
  return iso.replace("T", " ").slice(11, 16);
}

function custName(wo: TodayWorkOrder): string {
  if (!wo.customers) return "—";
  return [wo.customers.last_name, wo.customers.first_name].filter(Boolean).join(" ") || "—";
}

interface Props {
  items:          TodayWorkOrder[];
  reservationToday: number;
}

export default function TodayReservationsCard({ items, reservationToday }: Props) {
  return (
    <div className="rounded-xl border border-slate-800 bg-[#0a0f1a] overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800 bg-[#0f172a]">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">本日のスケジュール</span>
          {items.length > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-900/50 text-blue-300 border border-blue-800/50">
              {items.length}件
            </span>
          )}
          {reservationToday > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-violet-900/50 text-violet-300 border border-violet-800/50">
              予約 {reservationToday}
            </span>
          )}
        </div>
        <Link href="/reservations" className="text-[10px] text-slate-500 hover:text-slate-300 transition-colors">
          予約一覧 →
        </Link>
      </div>

      {items.length === 0 ? (
        <div className="py-10 text-center">
          <p className="text-xs text-slate-600">本日の予約はありません。</p>
          <Link
            href="/reservations"
            className="inline-block mt-3 text-[10px] px-3 py-1.5 rounded-lg border border-slate-700 text-slate-500 hover:bg-slate-800 transition-colors"
          >
            予約を作成 →
          </Link>
        </div>
      ) : (
        <div className="flex flex-col divide-y divide-slate-800/50">
          {items.map(wo => (
            <div key={wo.id} className="flex items-center gap-3 px-5 py-3">
              {/* Time */}
              <div className="text-right shrink-0 w-16">
                <p className="text-xs font-medium text-slate-300">{fmt(wo.scheduled_start_at)}</p>
                {wo.scheduled_end_at && (
                  <p className="text-[10px] text-slate-600">{fmt(wo.scheduled_end_at)}</p>
                )}
              </div>

              {/* Divider */}
              <div className="w-px h-8 bg-slate-800 shrink-0" />

              {/* Status + customer */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${STATUS_BADGE[wo.status] ?? "bg-slate-700 text-slate-400"}`}>
                    {STATUS_LABEL[wo.status] ?? wo.status}
                  </span>
                  <p className="text-xs font-medium text-slate-200 truncate">{custName(wo)}</p>
                </div>
                <p className="text-[10px] text-slate-500 truncate">
                  {wo.vehicles
                    ? [wo.vehicles.maker, wo.vehicles.model, wo.vehicles.plate_number].filter(Boolean).join(" ")
                    : "—"}
                  {wo.title && <span className="ml-1 text-slate-600">· {wo.title}</span>}
                </p>
              </div>

              {/* Staff */}
              {wo.assigned_staff && (
                <p className="text-[10px] text-slate-500 shrink-0">{wo.assigned_staff}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
