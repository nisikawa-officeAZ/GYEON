"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  ReservationDB,
  reservationDisplayNo,
  reservationStatusLabel,
  reservationStatusColor,
  serviceTypeLabel,
} from "@/lib/reservations/reservation-types";
import { updateReservation, createWorkOrderFromReservation } from "@/lib/reservations/update-reservation";
import { cancelReservation } from "@/lib/reservations/cancel-reservation";
import { GdaOperationalListEmptyState } from "@/components/ui/GdaOperationalListSurface";

interface Props {
  reservations: ReservationDB[];
  onEdit?: (r: ReservationDB) => void;
  onRefresh?: () => void;
}

export function shouldShowEstimateAction(status: ReservationDB["status"]): boolean {
  return status === "pending" || status === "confirmed";
}

export function estimateCreateUrl(reservationId: string): string {
  const params = new URLSearchParams({ reservation_id: reservationId });
  return `/estimates/new?${params.toString()}`;
}

export function stopRowClick(e: { stopPropagation: () => void }): void {
  e.stopPropagation();
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
          className={`px-4 py-2.5 mx-3 mt-3 rounded-xl text-sm ${
            message.type === "success"
              ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/30"
              : "bg-red-500/10 text-red-300 border border-red-500/30"
          }`}
        >
          {message.text}
        </div>
      )}

      {reservations.length === 0 ? (
        <GdaOperationalListEmptyState
          messageJa="予約がありません"
          messageEn="NO RESERVATIONS YET"
        />
      ) : (
        <>
          {/* Desktop / tablet (>=768px): table-first presentation. */}
          <div className="hidden md:block">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#20304a]">
                    <th className="text-left text-xs font-medium text-[#7788a4] px-3 py-2.5 lg:px-4 lg:py-3">予約番号</th>
                    <th className="text-left text-xs font-medium text-[#7788a4] px-3 py-2.5 lg:px-4 lg:py-3">日時</th>
                    <th className="text-left text-xs font-medium text-[#7788a4] px-3 py-2.5 lg:px-4 lg:py-3 hidden sm:table-cell">顧客</th>
                    <th className="text-left text-xs font-medium text-[#7788a4] px-3 py-2.5 lg:px-4 lg:py-3 hidden md:table-cell">車両</th>
                    <th className="text-left text-xs font-medium text-[#7788a4] px-3 py-2.5 lg:px-4 lg:py-3 hidden lg:table-cell">施工内容</th>
                    <th className="text-left text-xs font-medium text-[#7788a4] px-3 py-2.5 lg:px-4 lg:py-3">ステータス</th>
                    <th className="text-left text-xs font-medium text-[#7788a4] px-3 py-2.5 lg:px-4 lg:py-3">アクション</th>
                  </tr>
                </thead>
                <tbody>
                  {reservations.map((r, i) => {
                    const busy = busyId === r.id && isPending;
                    return (
                      <tr
                        key={r.id}
                        className={`border-b border-[#1a2740] hover:bg-[#141e2f] transition-colors cursor-pointer ${
                          i === reservations.length - 1 ? "border-b-0" : ""
                        }`}
                        onClick={() => onEdit?.(r)}
                      >
                        <td className="px-3 py-2.5 lg:px-4 lg:py-3 font-mono text-xs text-[#edf3fc] whitespace-nowrap">
                          {reservationDisplayNo(r)}
                        </td>
                        <td className="px-3 py-2.5 lg:px-4 lg:py-3 text-[#c3cee2] whitespace-nowrap">
                          <div>{formatDate(r.reservation_date)}</div>
                          {r.start_time && (
                            <div className="text-xs text-[#7788a4]">
                              {r.start_time.slice(0, 5)}
                              {r.end_time && ` – ${r.end_time.slice(0, 5)}`}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2.5 lg:px-4 lg:py-3 text-[#8191ad] whitespace-nowrap hidden sm:table-cell">
                          {r.customers
                            ? [r.customers.last_name, r.customers.first_name].filter(Boolean).join(" ")
                            : <span className="text-[#425169]">—</span>}
                        </td>
                        <td className="px-3 py-2.5 lg:px-4 lg:py-3 text-[#8191ad] text-xs whitespace-nowrap hidden md:table-cell">
                          {r.vehicles
                            ? [r.vehicles.maker, r.vehicles.model, r.vehicles.plate_number].filter(Boolean).join(" ")
                            : <span className="text-[#425169]">—</span>}
                        </td>
                        <td className="px-3 py-2.5 lg:px-4 lg:py-3 text-[#8191ad] text-xs whitespace-nowrap hidden lg:table-cell">
                          {serviceTypeLabel(r.service_type)}
                        </td>
                        <td className="px-3 py-2.5 lg:px-4 lg:py-3">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded border text-xs ${reservationStatusColor(r.status)}`}
                          >
                            {reservationStatusLabel(r.status)}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 lg:px-4 lg:py-3">
                          <div
                            className="flex flex-wrap items-center gap-1.5"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {r.status === "pending" && (
                              <button
                                disabled={busy}
                                onClick={() => handleConfirm(r)}
                                className="min-h-[36px] px-2.5 py-2 rounded-lg text-xs border border-[#2f5db8]/50 text-[#5f9cff] hover:bg-[#173463]/40 transition-colors disabled:opacity-50"
                              >
                                確定
                              </button>
                            )}
                            {r.status === "confirmed" && !r.work_order_id && (
                              <button
                                disabled={busy}
                                onClick={() => handleCreateWO(r)}
                                className="min-h-[36px] px-2.5 py-2 rounded-lg text-xs border border-emerald-800/40 text-emerald-400 hover:bg-emerald-950/30 transition-colors disabled:opacity-50"
                              >
                                施工指示作成
                              </button>
                            )}
                            {shouldShowEstimateAction(r.status) && (
                              <Link
                                href={estimateCreateUrl(r.id)}
                                onClick={stopRowClick}
                                className="min-h-[36px] flex items-center px-2.5 py-2 rounded-lg text-xs text-[#8191ad] hover:text-[#edf3fc] hover:bg-[#1a2740] transition-colors"
                              >
                                見積を作成
                              </Link>
                            )}
                            {!["cancelled", "no_show", "completed"].includes(r.status) && (
                              <button
                                disabled={busy}
                                onClick={() => handleCancel(r)}
                                className="min-h-[36px] px-2.5 py-2 rounded-lg text-xs text-[#8191ad] hover:text-red-300 hover:bg-red-950/30 transition-colors disabled:opacity-50"
                              >
                                キャンセル
                              </button>
                            )}
                            {busy && (
                              <span className="text-xs text-[#7788a4]">処理中...</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile (<768px): stacked records replace the wide table. */}
          <div className="flex flex-col gap-3 p-3 md:hidden">
            {reservations.map((r) => {
              const busy = busyId === r.id && isPending;
              return (
                <div
                  key={r.id}
                  onClick={() => onEdit?.(r)}
                  className="rounded-2xl border border-[#263955] bg-[#0d1420] p-4 cursor-pointer"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-mono text-[13px] font-bold text-[#edf3fc]">{reservationDisplayNo(r)}</p>
                      <p className="truncate text-[11px] text-[#8191ad]">
                        {formatDate(r.reservation_date)}
                        {r.start_time && (
                          <>
                            {" "}
                            {r.start_time.slice(0, 5)}
                            {r.end_time && ` – ${r.end_time.slice(0, 5)}`}
                          </>
                        )}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded border text-xs ${reservationStatusColor(r.status)}`}
                    >
                      {reservationStatusLabel(r.status)}
                    </span>
                  </div>

                  <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-[12px]">
                    <div>
                      <dt className="text-[#7788a4]">顧客</dt>
                      <dd className="truncate text-[#c3cee2]">
                        {r.customers
                          ? [r.customers.last_name, r.customers.first_name].filter(Boolean).join(" ")
                          : "—"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[#7788a4]">車両</dt>
                      <dd className="truncate text-[#c3cee2]">
                        {r.vehicles
                          ? [r.vehicles.maker, r.vehicles.model, r.vehicles.plate_number].filter(Boolean).join(" ")
                          : "—"}
                      </dd>
                    </div>
                    <div className="col-span-2">
                      <dt className="text-[#7788a4]">施工内容</dt>
                      <dd className="text-[#c3cee2]">{serviceTypeLabel(r.service_type)}</dd>
                    </div>
                  </dl>

                  <div className="mt-3 flex flex-wrap gap-2" onClick={(e) => e.stopPropagation()}>
                    {r.status === "pending" && (
                      <button
                        disabled={busy}
                        onClick={() => handleConfirm(r)}
                        className="min-h-[44px] flex-1 rounded-xl border border-[#2f5db8]/50 text-xs font-medium text-[#5f9cff] hover:bg-[#173463]/40 transition-colors disabled:opacity-50"
                      >
                        確定
                      </button>
                    )}
                    {r.status === "confirmed" && !r.work_order_id && (
                      <button
                        disabled={busy}
                        onClick={() => handleCreateWO(r)}
                        className="min-h-[44px] flex-1 rounded-xl border border-emerald-800/40 text-xs font-medium text-emerald-400 hover:bg-emerald-950/30 transition-colors disabled:opacity-50"
                      >
                        施工指示作成
                      </button>
                    )}
                    {shouldShowEstimateAction(r.status) && (
                      <Link
                        href={estimateCreateUrl(r.id)}
                        onClick={stopRowClick}
                        className="min-h-[44px] flex-1 flex items-center justify-center rounded-xl border border-[#263955] text-xs font-medium text-[#8191ad] hover:text-[#edf3fc] hover:bg-[#1a2740] transition-colors"
                      >
                        見積を作成
                      </Link>
                    )}
                    {!["cancelled", "no_show", "completed"].includes(r.status) && (
                      <button
                        disabled={busy}
                        onClick={() => handleCancel(r)}
                        className="min-h-[44px] flex-1 rounded-xl border border-[#263955] text-xs font-medium text-[#8191ad] hover:text-red-300 hover:bg-red-950/30 transition-colors disabled:opacity-50"
                      >
                        キャンセル
                      </button>
                    )}
                    {busy && (
                      <span className="self-center text-xs text-[#7788a4]">処理中...</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
