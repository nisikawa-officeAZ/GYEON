"use client";

import { useState, useTransition } from "react";
import {
  ReservationDB,
  reservationDisplayNo,
  reservationStatusLabel,
  reservationStatusColor,
  serviceTypeLabel,
} from "@/lib/reservations/reservation-types";
import { updateReservation, createWorkOrderFromReservation } from "@/lib/reservations/update-reservation";
import { cancelReservation } from "@/lib/reservations/cancel-reservation";

interface Props {
  reservations: ReservationDB[];
  onEdit?: (r: ReservationDB) => void;
  onRefresh?: () => void;
}

function formatDate(date: string): string {
  const d = new Date(date + "T00:00:00");
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
}

export default function ReservationTable({ reservations, onEdit, onRefresh }: Props) {
  const [isPending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  function showMsg(type: "success" | "error", text: string) {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  }

  function handleConfirm(r: ReservationDB) {
    setBusyId(r.id);
    startTransition(async () => {
      const res = await updateReservation(r.id, { status: "confirmed" });
      setBusyId(null);
      if (res.success) {
        showMsg("success", "予約を確定しました");
        onRefresh?.();
      } else {
        showMsg("error", res.error ?? "エラーが発生しました");
      }
    });
  }

  function handleCreateWO(r: ReservationDB) {
    setBusyId(r.id);
    startTransition(async () => {
      const res = await createWorkOrderFromReservation(r.id);
      setBusyId(null);
      if (res.success) {
        showMsg("success", "作業指示書を作成しました");
        onRefresh?.();
      } else {
        showMsg("error", res.error ?? "エラーが発生しました");
      }
    });
  }

  function handleCancel(r: ReservationDB) {
    if (!confirm("この予約をキャンセルしますか?")) return;
    setBusyId(r.id);
    startTransition(async () => {
      const res = await cancelReservation(r.id);
      setBusyId(null);
      if (res.success) {
        showMsg("success", "予約をキャンセルしました");
        onRefresh?.();
      } else {
        showMsg("error", res.error ?? "エラーが発生しました");
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {message && (
        <div
          className={`px-4 py-2 rounded-lg text-sm ${
            message.type === "success"
              ? "bg-green-500/10 text-green-400 border border-green-500/30"
              : "bg-red-500/10 text-red-400 border border-red-500/30"
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-800 bg-[#0f172a]">
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">予約番号</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">日時</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">顧客</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">車両</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">施工内容</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">ステータス</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">アクション</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {reservations.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm text-slate-500">
                  予約がありません
                </td>
              </tr>
            ) : (
              reservations.map((r) => {
                const busy = busyId === r.id && isPending;
                return (
                  <tr
                    key={r.id}
                    className="bg-[#0f172a] hover:bg-[#1e293b] transition-colors cursor-pointer"
                    onClick={() => onEdit?.(r)}
                  >
                    <td className="px-4 py-3 text-slate-300 font-mono text-xs">
                      {reservationDisplayNo(r)}
                    </td>
                    <td className="px-4 py-3 text-slate-300 whitespace-nowrap">
                      <div>{formatDate(r.reservation_date)}</div>
                      {r.start_time && (
                        <div className="text-xs text-slate-500">
                          {r.start_time.slice(0, 5)}
                          {r.end_time && ` – ${r.end_time.slice(0, 5)}`}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-300">
                      {r.customers
                        ? [r.customers.last_name, r.customers.first_name].filter(Boolean).join(" ")
                        : <span className="text-slate-600">—</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-xs">
                      {r.vehicles
                        ? [r.vehicles.maker, r.vehicles.model, r.vehicles.plate_number].filter(Boolean).join(" ")
                        : <span className="text-slate-600">—</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-300 text-xs">
                      {serviceTypeLabel(r.service_type)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded border text-xs ${reservationStatusColor(r.status)}`}
                      >
                        {reservationStatusLabel(r.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div
                        className="flex items-center gap-1.5"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {r.status === "pending" && (
                          <button
                            disabled={busy}
                            onClick={() => handleConfirm(r)}
                            className="px-2 py-1 bg-blue-600/80 hover:bg-blue-600 text-white text-xs rounded transition-colors disabled:opacity-50"
                          >
                            確定
                          </button>
                        )}
                        {r.status === "confirmed" && !r.work_order_id && (
                          <button
                            disabled={busy}
                            onClick={() => handleCreateWO(r)}
                            className="px-2 py-1 bg-green-600/80 hover:bg-green-600 text-white text-xs rounded transition-colors disabled:opacity-50"
                          >
                            WO作成
                          </button>
                        )}
                        {!["cancelled", "no_show", "completed"].includes(r.status) && (
                          <button
                            disabled={busy}
                            onClick={() => handleCancel(r)}
                            className="px-2 py-1 bg-slate-700 hover:bg-red-700 text-slate-300 hover:text-white text-xs rounded transition-colors disabled:opacity-50"
                          >
                            キャンセル
                          </button>
                        )}
                        {busy && (
                          <span className="text-xs text-slate-500">処理中...</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
